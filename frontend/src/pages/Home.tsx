import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import UploadZone from '../components/UploadZone'
import URLIngest from '../components/URLIngest'
import { mediaService } from '../services/mediaService'

export default function Home() {
  const navigate = useNavigate()
  const [showURLIngest, setShowURLIngest] = useState(false)

  const { refetch } = useQuery({
    queryKey: ['media'],
    queryFn: () => mediaService.listMedia(0, 10),
  })

  const handleUploadSuccess = (mediaId: number) => {
    refetch()
    setTimeout(() => {
      navigate(`/media/${mediaId}`)
    }, 1000)
  }

  return (
    <div style={{
      maxWidth: '860px',
      margin: '0 auto',
      padding: '3.5rem 1.5rem 4rem',
    }}>
      {/* Value prop & Headline */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.3rem 0.75rem',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: 'var(--radius-pill)',
          color: '#a5b4fc',
          fontSize: '0.75rem',
          fontWeight: 600,
          marginBottom: '1rem',
          letterSpacing: '0.02em',
        }}>
          AI MULTIMODAL VIDEO SEARCH & MOMENT RETRIEVAL
        </div>

        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
          marginBottom: '0.75rem',
          color: 'var(--text-pure)',
        }}>
          Search video by actions, dialogue, and reference images.
        </h1>

        <p style={{
          fontSize: '1rem',
          color: 'var(--text-secondary)',
          maxWidth: '580px',
          margin: '0 auto 1.75rem',
          lineHeight: 1.5,
        }}>
          Describe physical events over time, search spoken words, or upload a reference face to locate exact video clips.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/search')}
            style={{
              padding: '0.65rem 1.4rem',
              fontSize: '0.9rem',
              fontWeight: 600,
              backgroundColor: 'var(--accent-primary)',
              color: '#fff',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            🔍 Open Search Workspace
          </button>
          <button
            onClick={() => navigate('/library')}
            style={{
              padding: '0.65rem 1.4rem',
              fontSize: '0.9rem',
              fontWeight: 500,
              backgroundColor: 'var(--bg-surface-0)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            Media Library
          </button>
        </div>
      </div>

      {/* Ingestion Box */}
      <div style={{
        backgroundColor: 'var(--bg-surface-0)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '2rem',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)',
      }}>
        <UploadZone onUploadSuccess={handleUploadSuccess} />

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          margin: '1.5rem 0',
        }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
          <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            or ingest direct video url
          </span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
        </div>

        <div>
          <button
            onClick={() => setShowURLIngest(!showURLIngest)}
            style={{
              padding: '0.6rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 500,
              backgroundColor: showURLIngest ? 'rgba(255, 255, 255, 0.08)' : 'var(--bg-surface-1)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              width: '100%',
              marginBottom: showURLIngest ? '1rem' : 0,
            }}
          >
            {showURLIngest ? '✕ Hide Direct URL Ingest' : '🔗 Ingest Media from Direct Video URL'}
          </button>

          {showURLIngest && (
            <URLIngest onIngestSuccess={handleUploadSuccess} />
          )}
        </div>
      </div>
    </div>
  )
}
