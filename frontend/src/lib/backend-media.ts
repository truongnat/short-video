export function backendVideoStreamUrl(id: string) {
  return `/api/videos/${id}/stream`;
}

export function backendVideoThumbnailUrl(id: string) {
  return `/api/videos/${id}/thumbnail`;
}

export function backendVideoSubtitleUrl(id: string) {
  return `/api/videos/${id}/subtitle`;
}
