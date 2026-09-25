import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'

export default function Home() {
  const { data: healthData } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get('/api/health').then(res => res.data),
  })

  return (
    <div style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '4rem 2rem',
      textAlign: 'center',
    }}>
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

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        alignItems: 'center',
      }}>
        <button style={{
          padding: '1rem 2rem',
          fontSize: '1rem',
          fontWeight: 500,
          backgroundColor: '#646cff',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          minWidth: '200px',
        }}>
          Upload Video
        </button>

        <button style={{
          padding: '1rem 2rem',
          fontSize: '1rem',
          fontWeight: 500,
          backgroundColor: 'transparent',
          color: 'rgba(255, 255, 255, 0.87)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '8px',
          cursor: 'pointer',
          minWidth: '200px',
        }}>
          Paste Video URL
        </button>
      </div>

      {healthData && (
        <div style={{
          marginTop: '3rem',
          padding: '1rem',
          backgroundColor: 'rgba(100, 108, 255, 0.1)',
          borderRadius: '8px',
          fontSize: '0.875rem',
          color: 'rgba(255, 255, 255, 0.6)',
        }}>
          Backend Status: {healthData.status} (v{healthData.version})
        </div>
      )}
    </div>
  )
}
