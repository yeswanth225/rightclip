import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Link,
  SpinnerGap,
  CheckCircle,
  WarningCircle,
  ArrowRight,
} from '@phosphor-icons/react'
import { mediaService } from '../services/mediaService'

interface URLIngestProps {
  onIngestSuccess?: (mediaId: number) => void
}

export default function URLIngest({ onIngestSuccess }: URLIngestProps) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  const ingestMutation = useMutation({
    mutationFn: (url: string) => mediaService.ingestURL(url),
    onSuccess: (data) => {
      setError('')
      setUrl('')
      if (onIngestSuccess) {
        onIngestSuccess(data.id)
      }
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'URL ingestion failed')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) {
      setError('Please enter a video URL')
      return
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setError('URL must start with http:// or https://')
      return
    }
    setError('')
    ingestMutation.mutate(url)
  }

  return (
    <div style={{ width: '100%' }}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <div style={{
            position: 'relative',
            flex: 1,
            display: 'flex',
            alignItems: 'center',
          }}>
            <span style={{
              position: 'absolute',
              left: '12px',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
            }}>
              <Link size={16} />
            </span>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/sample_video.mp4"
              disabled={ingestMutation.isPending}
              style={{
                width: '100%',
                padding: '0.65rem 1rem 0.65rem 2.4rem',
                fontSize: '0.875rem',
                backgroundColor: 'var(--bg-surface-1)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-pure)',
                outline: 'none',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={ingestMutation.isPending || !url.trim()}
            style={{
              padding: '0.65rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              backgroundColor: 'var(--accent-primary)',
              color: '#fff',
              borderRadius: 'var(--radius-sm)',
              opacity: ingestMutation.isPending || !url.trim() ? 0.6 : 1,
            }}
          >
            {ingestMutation.isPending ? (
              <>
                <SpinnerGap size={16} className="anim-pulse" />
                <span>Downloading...</span>
              </>
            ) : (
              <>
                <span>Ingest</span>
                <ArrowRight size={14} weight="bold" />
              </>
            )}
          </button>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Enter a direct URL to an authorized public MP4/WebM video stream.
        </p>
      </form>

      {error && (
        <div style={{
          marginTop: '0.75rem',
          padding: '0.65rem 0.85rem',
          backgroundColor: 'var(--accent-rose-subtle)',
          border: '1px solid var(--accent-rose-border)',
          borderRadius: 'var(--radius-sm)',
          color: '#fb7185',
          fontSize: '0.8rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
        }}>
          <WarningCircle size={16} weight="bold" />
          <span>{error}</span>
        </div>
      )}

      {ingestMutation.isSuccess && (
        <div style={{
          marginTop: '0.75rem',
          padding: '0.65rem 0.85rem',
          backgroundColor: 'var(--accent-emerald-subtle)',
          border: '1px solid var(--accent-emerald-border)',
          borderRadius: 'var(--radius-sm)',
          color: '#34d399',
          fontSize: '0.8rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
        }}>
          <CheckCircle size={16} weight="bold" />
          <span>URL accepted. Fetching video & starting background analysis...</span>
        </div>
      )}
    </div>
  )
}
