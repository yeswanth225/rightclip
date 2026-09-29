import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  MagnifyingGlass,
  FilmStrip,
  Sparkle,
  Link,
  Lightning,
  Eye,
} from '@phosphor-icons/react'
import UploadZone from '../components/UploadZone'

import URLIngest from '../components/URLIngest'
import { mediaService } from '../services/mediaService'
import { getAssetUrl } from '../utils/assets'

export default function Home() {
  const navigate = useNavigate()
  const [showURLIngest, setShowURLIngest] = useState(false)

  const { data: mediaList, refetch } = useQuery({
    queryKey: ['media'],
    queryFn: () => mediaService.listMedia(0, 6),
  })

  const handleUploadSuccess = (mediaId: number) => {
    refetch()
    setTimeout(() => {
      navigate(`/media/${mediaId}`)
    }, 800)
  }

  const exampleSearches = [
    { label: 'the character walks into the room', mode: 'action', icon: Lightning },
    { label: 'person picks up a phone', mode: 'action', icon: Lightning },
    { label: 'two people fighting', mode: 'action', icon: Lightning },
    { label: 'blue car at night', mode: 'visual', icon: Eye },
    { label: 'person standing near a building', mode: 'visual', icon: Eye },
  ]

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '—'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '3.5rem 1.5rem 5rem' }}>
      {/* Hero Section */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          padding: '0.3rem 0.85rem',
          backgroundColor: 'var(--accent-primary-subtle)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: 'var(--radius-pill)',
          color: '#a5b4fc',
          fontSize: '0.75rem',
          fontWeight: 600,
          marginBottom: '1.25rem',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}>
          <Sparkle size={14} weight="fill" />
          <span>Local Multimodal Video Search Intelligence</span>
        </div>

        <h1 style={{
          fontSize: '2.75rem',
          fontWeight: 800,
          letterSpacing: '-0.035em',
          lineHeight: 1.15,
          marginBottom: '0.85rem',
          color: 'var(--text-pure)',
        }}>
          Search video moments by <span style={{ color: '#818cf8' }}>actions</span>, <span style={{ color: '#22d3ee' }}>dialogue</span>, & <span style={{ color: '#c084fc' }}>faces</span>.
        </h1>

        <p style={{
          fontSize: '1.05rem',
          color: 'var(--text-secondary)',
          maxWidth: '640px',
          margin: '0 auto 2rem',
          lineHeight: 1.55,
        }}>
          Describe physical movements across time, search exact or semantic speech phrases, or provide reference photos to pinpoint video moments with frame precision.
        </p>

        {/* Primary Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/search')}
            style={{
              padding: '0.75rem 1.6rem',
              fontSize: '0.92rem',
              fontWeight: 600,
              backgroundColor: 'var(--accent-primary)',
              color: '#fff',
              borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            <MagnifyingGlass size={18} weight="bold" />
            <span>Open Search Workspace</span>
          </button>

          <button
            onClick={() => navigate('/library')}
            style={{
              padding: '0.75rem 1.4rem',
              fontSize: '0.92rem',
              fontWeight: 500,
              backgroundColor: 'var(--bg-surface-0)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <FilmStrip size={18} />
            <span>Browse Media Library</span>
          </button>
        </div>

        {/* Quick Search Ideas Chips */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
          marginTop: '1.75rem',
        }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Try searching:
          </span>
          {exampleSearches.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(`/search?q=${encodeURIComponent(item.label)}&mode=${item.mode}`)}
              style={{
                padding: '0.25rem 0.65rem',
                fontSize: '0.75rem',
                backgroundColor: 'var(--bg-surface-0)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-pill)',
                gap: '0.35rem',
              }}
            >
              <item.icon size={12} color="#818cf8" />
              <span>"{item.label}"</span>
            </button>
          ))}
        </div>
      </div>

      {/* Video Ingest Center */}
      <div style={{
        backgroundColor: 'var(--bg-surface-0)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '2rem',
        boxShadow: 'var(--shadow-md)',
        marginBottom: '3rem',
      }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-pure)' }}>
            Ingest Video Asset
          </h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Uploaded videos are automatically transcoded to 720p proxies, split into scenes, transcribed via speech AI, and indexed with OpenCLIP vector embeddings.
          </p>
        </div>

        <UploadZone onUploadSuccess={handleUploadSuccess} />

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          margin: '1.5rem 0',
        }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
          <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            or ingest direct video url
          </span>
          <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-subtle)' }} />
        </div>

        <div>
          <button
            onClick={() => setShowURLIngest(!showURLIngest)}
            style={{
              padding: '0.65rem 1rem',
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
            <Link size={16} />
            <span>{showURLIngest ? 'Hide Direct URL Ingest' : 'Ingest from Direct Video URL'}</span>
          </button>

          {showURLIngest && (
            <URLIngest onIngestSuccess={handleUploadSuccess} />
          )}
        </div>
      </div>

      {/* Recently Indexed Media Quick Access */}
      {mediaList && mediaList.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-pure)' }}>
              Recently Indexed Media
            </h3>
            <button
              onClick={() => navigate('/library')}
              style={{
                fontSize: '0.8rem',
                color: '#818cf8',
                background: 'transparent',
                padding: '0.2rem 0.5rem',
              }}
            >
              View all ({mediaList.length}) →
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1rem',
          }}>
            {mediaList.slice(0, 3).map((media) => {
              const thumbUrl = getAssetUrl(media.thumbnail_path)
              return (
                <div
                  key={media.id}
                  onClick={() => navigate(`/media/${media.id}`)}
                  style={{
                    backgroundColor: 'var(--bg-surface-0)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-medium)'
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface-1)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)'
                    e.currentTarget.style.backgroundColor = 'var(--bg-surface-0)'
                  }}
                >
                  <div style={{
                    aspectRatio: '16/9',
                    backgroundColor: '#000',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    position: 'relative',
                    marginBottom: '0.65rem',
                  }}>
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={media.filename}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
                        <FilmStrip size={28} />
                      </div>
                    )}
                    {media.duration && (
                      <span style={{
                        position: 'absolute',
                        bottom: '5px',
                        right: '5px',
                        backgroundColor: 'rgba(0, 0, 0, 0.85)',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        fontSize: '0.7rem',
                        fontFamily: 'JetBrains Mono, monospace',
                        color: '#fff',
                      }}>
                        {formatDuration(media.duration)}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: 'var(--text-pure)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '180px',
                    }}>
                      {media.filename}
                    </span>
                    <span style={{
                      fontSize: '0.7rem',
                      fontFamily: 'JetBrains Mono, monospace',
                      color: media.status === 'ready' ? '#34d399' : '#fbbf24',
                    }}>
                      {media.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
