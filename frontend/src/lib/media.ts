export function proxiedMediaUrl(src?: string | null): string | undefined {
  if (!src) return undefined;

  const params = new URLSearchParams({ src });
  return `/api/media?${params.toString()}`;
}
