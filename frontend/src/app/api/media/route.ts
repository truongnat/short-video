import { NextRequest } from 'next/server';

const DEFAULT_ALLOWED_UPSTREAMS = ['minio:9000'];
const DEFAULT_ALLOWED_PATH_PREFIXES = ['/videos/'];
const ALLOWED_CONTENT_TYPES = [
  'image/',
  'video/',
  'audio/',
  'text/vtt',
  'application/octet-stream',
  'application/vnd.apple.mpegurl',
];

function parseCsvEnv(raw: string | undefined, fallback: string[]) {
  if (!raw) return fallback;

  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function getAllowedUpstreams() {
  return parseCsvEnv(process.env.MEDIA_PROXY_ALLOWED_HOSTS, DEFAULT_ALLOWED_UPSTREAMS);
}

function getAllowedPathPrefixes() {
  return parseCsvEnv(
    process.env.MEDIA_PROXY_ALLOWED_PATH_PREFIXES,
    DEFAULT_ALLOWED_PATH_PREFIXES,
  );
}

export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get('src');
  if (!src) {
    return new Response('Missing src', { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(src);
  } catch {
    return new Response('Invalid src', { status: 400 });
  }

  if (!['http:', 'https:'].includes(target.protocol)) {
    return new Response('Unsupported protocol', { status: 400 });
  }

  const allowedUpstreams = getAllowedUpstreams();
  if (!allowedUpstreams.includes(target.host)) {
    return new Response('Upstream not allowed', { status: 403 });
  }

  const allowedPathPrefixes = getAllowedPathPrefixes();
  if (!allowedPathPrefixes.some((prefix) => target.pathname.startsWith(prefix))) {
    return new Response('Path not allowed', { status: 403 });
  }

  const upstream = await fetch(target, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(upstream.statusText || 'Upstream fetch failed', {
      status: upstream.status || 502,
    });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');
  if (
    contentType &&
    !ALLOWED_CONTENT_TYPES.some((allowedType) => contentType.startsWith(allowedType))
  ) {
    return new Response('Content type not allowed', { status: 415 });
  }
  const contentLength = upstream.headers.get('content-length');
  const contentDisposition = upstream.headers.get('content-disposition');

  if (contentType) headers.set('content-type', contentType);
  if (contentLength) headers.set('content-length', contentLength);
  if (contentDisposition) headers.set('content-disposition', contentDisposition);
  headers.set('cache-control', 'no-store');

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
