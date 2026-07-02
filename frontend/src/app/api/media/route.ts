import { NextRequest } from 'next/server';

const DEFAULT_ALLOWED_HOSTS = ['minio', 'localhost', '127.0.0.1'];

function getAllowedHosts() {
  const raw = process.env.MEDIA_PROXY_ALLOWED_HOSTS;
  if (!raw) return DEFAULT_ALLOWED_HOSTS;

  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
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

  const allowedHosts = getAllowedHosts();
  if (!allowedHosts.includes(target.hostname)) {
    return new Response('Host not allowed', { status: 403 });
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
