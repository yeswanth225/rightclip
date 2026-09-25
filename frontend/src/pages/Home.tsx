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
    // Refetch media list and navigate to media detail
    refetch()
    setTimeout(() => {
      navigate(`/media/${mediaId}`)
    }, 1500)
  }

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '4rem 2rem',
    }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{
          fontSize: '3rem',
          fontWeight: 700,
          marginBottom: '1rem',
        }}>
          ClipFinder
        </h1>

        <p style={{
          fontSize: '1.25rem',
          color: 'rgba(255, 255, 255, 0.7)',
          marginBottom: '3rem',
        }}>
          Find any moment in your video.
        </p>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <UploadZone onUploadSuccess={handleUploadSuccess} />
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        margin: '2rem 0',
      }}>
        <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
        <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.875rem' }}>or</span>
        <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
      </div>

      <div>
        <button
          onClick={() => setShowURLIngest(!showURLIngest)}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            fontWeight: 500,
            backgroundColor: 'transparent',
            color: 'rgba(255, 255, 255, 0.87)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            cursor: 'pointer',
            width: '100%',
            marginBottom: '1rem',
          }}
        >
          {showURLIngest ? '✕ Close URL Ingest' : '🔗 Ingest from URL'}
        </button>

        {showURLIngest && (
          <URLIngest onIngestSuccess={handleUploadSuccess} />
        )}
      </div>

      <div style={{
        marginTop: '3rem',
        textAlign: 'center',
      }}>
        <button
          onClick={() => navigate('/library')}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            color: 'rgba(255, 255, 255, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          📚 View Media Library
        </button>
      </div>
    </div>
  )
}
