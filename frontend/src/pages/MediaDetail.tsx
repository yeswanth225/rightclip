import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { mediaService } from '../services/mediaService'

export default function MediaDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: media, isLoading, error } = useQuery({
    queryKey: ['media', id],
    queryFn: () => mediaService.getMedia(Number(id)),
    refetchInterval: (query) => {
      // Poll every 2 seconds if still processing
      const data = query.state.data
      if (data?.status && ['uploaded', 'downloading', 'validating', 'processing'].includes(data.status)) {
        return 2000
      }
      return false
    },
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

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)' }}>
        Loading media details...
      </div>
    )
  }

  if (error || !media) {
    return (
      <div style={{ padding: '2rem' }}>
        <div style={{
          padding: '1rem',
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          borderRadius: '8px',
          color: '#ff6b6b',
        }}>
          Media asset not found
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <button
          onClick={() => navigate('/library')}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            color: 'rgba(255, 255, 255, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '6px',
            cursor: 'pointer',
            marginBottom: '2rem',
          }}
        >
          ← Back to Library
        </button>

        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>
          {media.filename}
        </h1>

        {/* Status Badge */}
        <div style={{
          display: 'inline-block',
          padding: '0.5rem 1rem',
          fontSize: '0.875rem',
          fontWeight: 500,
          backgroundColor: `${getStatusColor(media.status)}20`,
          color: getStatusColor(media.status),
          borderRadius: '12px',
          marginBottom: '2rem',
        }}>
          Status: {media.status.toUpperCase()}
        </div>

        {/* Processing indicator */}
        {['uploaded', 'downloading', 'validating', 'processing'].includes(media.status) && (
          <div style={{
            padding: '1rem',
            backgroundColor: 'rgba(251, 191, 36, 0.1)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            borderRadius: '8px',
            color: '#fbbf24',
            marginBottom: '2rem',
          }}>
            ⏳ Processing video... This page will update automatically.
          </div>
        )}

        {/* Error message */}
        {media.error_message && (
          <div style={{
            padding: '1rem',
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            borderRadius: '8px',
            color: '#ff6b6b',
            marginBottom: '2rem',
          }}>
            <strong>Error:</strong> {media.error_message}
          </div>
        )}

        {/* Metadata */}
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '1.5rem',
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
            Media Information
          </h2>

          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <MetadataRow label="Source Type" value={media.source_type} />
            {media.source_url && <MetadataRow label="Source URL" value={media.source_url} />}
            <MetadataRow label="File Size" value={media.file_size ? `${(media.file_size / (1024 * 1024)).toFixed(2)} MB` : '—'} />
            <MetadataRow label="Duration" value={media.duration ? `${Math.floor(media.duration / 60)}:${Math.floor(media.duration % 60).toString().padStart(2, '0')}` : '—'} />
            <MetadataRow label="Resolution" value={media.width && media.height ? `${media.width} × ${media.height}` : '—'} />
            <MetadataRow label="FPS" value={media.fps ? media.fps.toFixed(2) : '—'} />
            <MetadataRow label="Video Codec" value={media.video_codec || '—'} />
            <MetadataRow label="Audio Codec" value={media.audio_codec || '—'} />
            <MetadataRow label="Created" value={new Date(media.created_at).toLocaleString()} />
          </div>
        </div>

        {media.status === 'ready' && (
          <div style={{ marginTop: '2rem', textAlign: 'center' }}>
            <p style={{ color: 'rgba(255, 255, 255, 0.6)', marginBottom: '1rem' }}>
              Video processing complete! Search functionality coming in Phase 3.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '0.5rem 0',
      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    }}>
      <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>{label}</span>
      <span style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}
