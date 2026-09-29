import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  FilmStrip,
  UploadSimple,
  MagnifyingGlass,
  Scissors,
  Trash,
  Pulse,
  WarningCircle,
  CheckCircle,
} from '@phosphor-icons/react'
import { mediaService } from '../services/mediaService'
import { getAssetUrl } from '../utils/assets'
import type { MediaAsset } from '../types/media'

export default function MediaLibrary() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: mediaAssets, isLoading, error } = useQuery({
    queryKey: ['media'],
    queryFn: () => mediaService.listMedia(0, 100),
    refetchInterval: 3000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => mediaService.deleteMedia(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] })
    },
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready':
        return <span className="badge-tag badge-ready"><CheckCircle size={12} weight="bold" /> Ready</span>
      case 'failed':
        return <span className="badge-tag badge-failed"><WarningCircle size={12} weight="bold" /> Failed</span>
      case 'processing':
      case 'validating':
      case 'downloading':
      case 'uploaded':
        return <span className="badge-tag badge-processing"><Pulse size={12} className="anim-pulse" /> {status}</span>
      default:
        return <span className="badge-tag">{status}</span>
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
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '2.5rem 1.5rem 5rem' }}>
      {/* Top action header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-pure)', letterSpacing: '-0.025em' }}>
            Media Library
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '2px' }}>
            Indexed video assets with speech transcripts, scene boundaries, and OpenCLIP vector index.
          </p>
        </div>

        <button
          onClick={() => navigate('/')}
          style={{
            padding: '0.6rem 1.2rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            backgroundColor: 'var(--accent-primary)',
            color: '#fff',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <UploadSimple size={16} weight="bold" />
          <span>Ingest New Video</span>
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
          backgroundColor: 'var(--accent-rose-subtle)',
          border: '1px solid var(--accent-rose-border)',
          borderRadius: 'var(--radius-md)',
          color: '#fb7185',
          fontSize: '0.88rem',
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
          <FilmStrip size={40} color="var(--text-dim)" style={{ marginBottom: '0.75rem' }} />
          <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-pure)', marginBottom: '0.4rem' }}>
            No media indexed yet
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Upload an MP4 or ingest a video stream to activate AI multimodal retrieval.
          </p>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '0.65rem 1.35rem',
              fontSize: '0.88rem',
              fontWeight: 600,
              backgroundColor: 'var(--accent-primary)',
              color: '#fff',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <UploadSimple size={16} weight="bold" />
            <span>Upload Authorized Video</span>
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
                      <FilmStrip size={32} color="var(--text-dim)" />
                    )}

                    {media.duration && (
                      <div style={{
                        position: 'absolute',
                        bottom: '6px',
                        right: '6px',
                        backgroundColor: 'rgba(0, 0, 0, 0.85)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontFamily: 'JetBrains Mono, monospace',
                        color: '#fff',
                        fontWeight: 600,
                      }}>
                        {formatDuration(media.duration)}
                      </div>
                    )}
                  </div>

                  {/* Title & Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.45rem' }}>
                    <h3 style={{
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      color: 'var(--text-pure)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}>
                      {media.filename}
                    </h3>
                  </div>

                  <div style={{ marginBottom: '0.75rem' }}>
                    {getStatusBadge(media.status)}
                  </div>
                </div>

                {/* Footer metadata & actions */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border-subtle)',
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  <span>{media.width ? `${media.width}×${media.height}` : '—'}</span>
                  <span>{formatFileSize(media.file_size)}</span>
                  
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/search?media_id=${media.id}`)
                      }}
                      style={{
                        background: 'transparent',
                        color: '#818cf8',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                      title="Search moments inside this video"
                    >
                      <MagnifyingGlass size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/media/${media.id}/edit-clip`)
                      }}
                      style={{
                        background: 'transparent',
                        color: 'var(--text-secondary)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                      title="Open Clip Editor"
                    >
                      <Scissors size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm(`Delete media '${media.filename}' and all associated vector embeddings?`)) {
                          deleteMutation.mutate(media.id)
                        }
                      }}
                      style={{
                        background: 'transparent',
                        color: 'var(--text-dim)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                      title="Delete video"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
