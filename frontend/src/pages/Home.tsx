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
    queryFn: () => mediaService.listMedia(),
  })

  const handleUploadSuccess = (mediaId: number) => {
    refetch()
    setTimeout(() => {
      navigate(`/media/${mediaId}`)
    }, 1200)
  }

  return (
    <div style={{
      maxWidth: '860px',
      margin: '0 auto',
      padding: '3.5rem 1.5rem',
    }}>
      {/* Hero Section */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.35rem 0.85rem',
          backgroundColor: 'rgba(99, 102, 241, 0.12)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: '9999px',
          color: '#a5b4fc',
          fontSize: '0.8rem',
          fontWeight: 600,
          marginBottom: '1.25rem',
        }}>
          ⚡ Local-First Multimodal AI Video Search
        </div>

        <h1 style={{
          fontSize: '3.25rem',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          lineHeight: 1.15,
          marginBottom: '1rem',
          background: 'linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Find any moment in your video.
        </h1>

        <p style={{
          fontSize: '1.125rem',
          color: 'rgba(255, 255, 255, 0.65)',
          maxWidth: '620px',
          margin: '0 auto 2rem',
          lineHeight: 1.6,
        }}>
          Search across spoken words and visual scenes using faster-whisper and OpenCLIP ViT-B/32, powered completely locally on your machine.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/search')}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '0.95rem',
              fontWeight: 600,
              backgroundColor: '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.4)',
            }}
          >
            🔍 Open AI Search
          </button>
          <button
            onClick={() => navigate('/library')}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '0.95rem',
              fontWeight: 500,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: 'rgba(255, 255, 255, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            📚 Media Library
          </button>
        </div>
      </div>

      {/* Ingestion Container */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '2rem',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <UploadZone onUploadSuccess={handleUploadSuccess} />
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          margin: '1.5rem 0',
        }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.08)' }} />
          <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            or ingest from url
          </span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.08)' }} />
        </div>

        <div>
          <button
            onClick={() => setShowURLIngest(!showURLIngest)}
            style={{
              padding: '0.65rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              backgroundColor: showURLIngest ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
              color: 'rgba(255, 255, 255, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              cursor: 'pointer',
              width: '100%',
              marginBottom: showURLIngest ? '1rem' : 0,
            }}
          >
            {showURLIngest ? '✕ Close URL Ingest' : '🔗 Ingest Media from Direct URL'}
          </button>

          {showURLIngest && (
            <URLIngest onIngestSuccess={handleUploadSuccess} />
          )}
        </div>
      </div>
    </div>
  )
}
