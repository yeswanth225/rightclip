/// <reference types="vite/client" />

/**
 * Standardize asset URL generation for thumbnails, keyframes, and video proxies.
 * Handles Windows backslashes, relative paths (e.g. './media/...', 'media/...'),
 * and absolute URLs.
 */
export function getAssetUrl(path?: string | null): string {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  // Normalize Windows backslashes
  let cleanPath = path.replace(/\\/g, '/')

  // Strip leading ./ or /
  cleanPath = cleanPath.replace(/^\.?\//, '')

  // Strip leading media/ if present so we can consistently mount at /media/...
  cleanPath = cleanPath.replace(/^media\//, '')

  // In development, Vite proxies /media to http://127.0.0.1:8000/media
  // Or in production, relative /media serves from backend
  const baseUrl = import.meta.env.VITE_ASSET_BASE_URL || ''
  const prefix = baseUrl ? `${baseUrl.replace(/\/$/, '')}/media` : '/media'

  return `${prefix}/${cleanPath}`
}
