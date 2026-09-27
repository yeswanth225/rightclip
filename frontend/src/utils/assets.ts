/// <reference types="vite/client" />

/**
 * Standardize asset URL generation for thumbnails, keyframes, and video proxies.
 * Handles Windows backslashes, absolute filesystem paths (e.g. 'D:/.../media/...'),
 * relative paths (e.g. './media/...', 'media/...'), and absolute HTTP URLs.
 */
export function getAssetUrl(path?: string | null): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  // Normalize Windows backslashes to forward slashes
  let cleanPath = path.replace(/\\/g, '/')

  // If a full filesystem path leaked in (e.g. D:/.../media/proxies/1/foo.mp4), strip up to /media/
  const mediaIdx = cleanPath.toLowerCase().indexOf('/media/')
  if (mediaIdx !== -1) {
    cleanPath = cleanPath.substring(mediaIdx + 7)
  }

  // Strip leading ./ or /
  cleanPath = cleanPath.replace(/^\.?\//, '')

  // Strip leading media/ if present
  cleanPath = cleanPath.replace(/^media\//i, '')

  // Safely URL-encode each path component while preserving directory slashes
  const encodedPath = cleanPath
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      try {
        return encodeURIComponent(decodeURIComponent(segment))
      } catch {
        return encodeURIComponent(segment)
      }
    })
    .join('/')

  if (!encodedPath) return ''

  // In development, Vite proxies /media to http://127.0.0.1:8000/media
  // Or in production, relative /media serves from backend
  const baseUrl = import.meta.env.VITE_ASSET_BASE_URL || ''
  const prefix = baseUrl ? `${baseUrl.replace(/\/$/, '')}/media` : '/media'

  return `${prefix}/${encodedPath}`
}
