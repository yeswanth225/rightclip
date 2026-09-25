import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { mediaService } from '../services/mediaService'
import { getAssetUrl } from '../utils/assets'
import type { MediaAsset } from '../types/media'

export default function MediaLibrary() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: mediaAssets, isLoading, error } = useQuery({
    queryKey: ['media'],
    queryFn: () => mediaService.listMedia(0, 50),
    refetchInterval: 3000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => mediaService.deleteMedia(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] })
    },
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'var(--accent-emerald)'
      case 'failed':
        return 'var(--accent-rose)'
      case 'processing':
      case 'validating':
      case 'downloading':
        return 'var(--accent-amber)'
      default:
        return 'var(--text-muted)'
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
        return 'Ready for Search'
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
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>
      {/* Top action header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
      }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-pure)', letterSpacing: '-0.02em' }}>
            Media Library
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '2px' }}>
            Indexed video assets ready for action, dialogue, and multimodal search.
          </p>
        </div>

        <button
          onClick={() => navigate('/')}
          style={{
            padding: '0.55rem 1.1rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            backgroundColor: 'var(--accent-primary)',
            color: '#fff',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          + Ingest New Video
        </button>
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Loading media library...
        </div>
      )}

      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: 'rgba(244, 63, 94, 0.1)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          borderRadius: 'var(--radius-md)',
          color: '#fb7185',
        }}>
          Failed to load media library: {String(error)}
        </div>
      )}

      {!isLoading && !error && mediaAssets?.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '4rem 2rem',
          backgroundColor: 'var(--bg-surface-0)',
          border: '1px dashed var(--border-strong)',
          borderRadius: 'var(--radius-lg)',
          maxWidth: '600px',
          margin: '2rem auto',
        }}>
          <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-pure)', marginBottom: '0.5rem' }}>
            No media indexed yet
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Upload an MP4 or ingest a video to enable AI multimodal retrieval.
          </p>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '0.65rem 1.25rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              backgroundColor: 'var(--accent-primary)',
              color: '#fff',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            Upload Authorized Video
          </button>
        </div>
      )}

      {/* Media Grid */}
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
                  backgroundColor: 'var(--bg-surface-0)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-strong)'
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface-1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)'
                  e.currentTarget.style.backgroundColor = 'var(--bg-surface-0)'
                }}
              >
                <div>
                  {/* Thumbnail viewport */}
                  <div style={{
                    aspectRatio: '16/9',
                    backgroundColor: '#000',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '0.85rem',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}>
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={media.filename}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ fontSize: '2rem', color: 'var(--text-dim)' }}>🎬</span>
                    )}

                    {media.duration && (
                      <div style={{
                        position: 'absolute',
                        bottom: '6px',
                        right: '6px',
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontFamily: 'JetBrains Mono, monospace',
                        color: '#fff',
                        fontWeight: 500,
                      }}>
                        {formatDuration(media.duration)}
                      </div>
                    )}
                  </div>

                  {/* Title & Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <h3 style={{
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      color: 'var(--text-pure)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}>
                      {media.filename}
                    </h3>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <span style={{
                      display: 'inline-block',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: getStatusColor(media.status),
                    }} />
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      color: getStatusColor(media.status),
                    }}>
                      {getStatusLabel(media.status)}
                    </span>
                  </div>
                </div>

                {/* Footer metadata & actions */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border-subtle)',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  <span>{media.width ? `${media.width}×${media.height}` : '—'}</span>
                  <span>{formatFileSize(media.file_size)}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm(`Delete media '${media.filename}' and all indexed vectors?`)) {
                        deleteMutation.mutate(media.id)
                      }
                    }}
                    style={{
                      background: 'transparent',
                      color: 'var(--text-dim)',
                      fontSize: '0.8rem',
                      padding: '2px 6px',
                      borderRadius: '4px',
                    }}
                    title="Delete media asset"
                  >
                    🗑
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
