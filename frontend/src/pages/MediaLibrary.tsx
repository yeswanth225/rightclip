import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { mediaService } from '../services/mediaService'
import { getAssetUrl } from '../utils/assets'
import type { MediaAsset } from '../types/media'

export default function MediaLibrary() {
  const navigate = useNavigate()

  const { data: mediaAssets, isLoading, error } = useQuery({
    queryKey: ['media'],
    queryFn: () => mediaService.listMedia(0, 50),
    refetchInterval: 3000, // Poll every 3 seconds for status updates
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return '#4ade80'
      case 'failed':
        return '#ff6b6b'
      case 'processing':
      case 'validating':
        return '#fbbf24'
      default:
        return '#94a3b8'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'uploaded':
        return 'Uploaded'
      case 'downloading':
        return 'Downloading...'
      case 'validating':
        return 'Validating...'
      case 'processing':
        return 'Processing...'
      case 'ready':
        return 'Ready'
      case 'failed':
        return 'Failed'
      default:
        return status
    }
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '—'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '—'
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Media Library</h1>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: 'rgba(255, 255, 255, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            ← Back to Upload
          </button>
        </div>

        {isLoading && (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255, 255, 255, 0.5)' }}>
            Loading media assets...
          </div>
        )}

        {error && (
          <div style={{
            padding: '1rem',
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            borderRadius: '8px',
            color: '#ff6b6b',
          }}>
            Failed to load media library
          </div>
        )}

        {!isLoading && !error && mediaAssets?.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            color: 'rgba(255, 255, 255, 0.5)',
          }}>
            <p style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>No media uploaded yet</p>
            <button
              onClick={() => navigate('/')}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                backgroundColor: '#646cff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Upload Your First Video
            </button>
          </div>
        )}

        {mediaAssets && mediaAssets.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.5rem',
          }}>
            {mediaAssets.map((media: MediaAsset) => {
              const thumbUrl = getAssetUrl(media.thumbnail_path)

              return (
                <div
                  key={media.id}
                  onClick={() => navigate(`/media/${media.id}`)}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '1rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)'
                    e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)'
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  {/* Real video thumbnail or placeholder */}
                  <div style={{
                    aspectRatio: '16/9',
                    backgroundColor: '#000',
                    borderRadius: '8px',
                    marginBottom: '1rem',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={media.filename}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ fontSize: '2.5rem' }}>🎬</span>
                    )}
                  </div>

                {/* Filename */}
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  marginBottom: '0.5rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {media.filename}
                </h3>

                {/* Status */}
                <div style={{
                  display: 'inline-block',
                  padding: '0.25rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  backgroundColor: `${getStatusColor(media.status)}20`,
                  color: getStatusColor(media.status),
                  borderRadius: '12px',
                  marginBottom: '0.75rem',
                }}>
                  {getStatusLabel(media.status)}
                </div>

                {/* Metadata */}
                <div style={{
                  display: 'flex',
                  gap: '1rem',
                  fontSize: '0.875rem',
                  color: 'rgba(255, 255, 255, 0.6)',
                }}>
                  <span>⏱ {formatDuration(media.duration)}</span>
                  <span>📊 {media.width}×{media.height || '—'}</span>
                  <span>💾 {formatFileSize(media.file_size)}</span>
                </div>

                {/* Error message */}
                {media.error_message && (
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.5rem',
                    fontSize: '0.75rem',
                    backgroundColor: 'rgba(220, 38, 38, 0.1)',
                    color: '#ff6b6b',
                    borderRadius: '6px',
                  }}>
                    {media.error_message}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  </div>
)
}
