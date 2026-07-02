const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:23001';

export function backendVideoStreamUrl(id: string) {
  return `${apiBaseUrl}/api/videos/${id}/stream`;
}

export function backendVideoThumbnailUrl(id: string) {
  return `${apiBaseUrl}/api/videos/${id}/thumbnail`;
}

export function backendVideoSubtitleUrl(id: string) {
  return `${apiBaseUrl}/api/videos/${id}/subtitle`;
}
