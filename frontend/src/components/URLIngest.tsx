import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
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
      setError('Please enter a URL')
      return
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setError('URL must start with http:// or https://')
      return
    }
    ingestMutation.mutate(url)
  }

  return (
    <div style={{ width: '100%' }}>
      <form onSubmit={handleSubmit}>
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '0.5rem',
          }}
        >
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/video.mp4"
            disabled={ingestMutation.isPending}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              fontSize: '1rem',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              color: 'rgba(255, 255, 255, 0.9)',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={ingestMutation.isPending}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 500,
              backgroundColor: '#646cff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: ingestMutation.isPending ? 'not-allowed' : 'pointer',
              opacity: ingestMutation.isPending ? 0.6 : 1,
            }}
          >
            {ingestMutation.isPending ? 'Processing...' : 'Ingest'}
          </button>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)' }}>
          Enter a direct URL to an authorized video file
        </p>
      </form>

      {error && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            borderRadius: '8px',
            color: '#ff6b6b',
          }}
        >
          {error}
        </div>
      )}

      {ingestMutation.isSuccess && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '8px',
            color: '#4ade80',
          }}
        >
          URL accepted! Downloading and processing...
        </div>
      )}
    </div>
  )
}
