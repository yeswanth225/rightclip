import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  MagnifyingGlass,
  FilmStrip,
  UploadSimple,
  Sparkle,
  Pulse,
} from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { mediaService } from '../services/mediaService'

export default function Layout() {
  const navigate = useNavigate()

  const { data: mediaList } = useQuery({
    queryKey: ['media'],
    queryFn: () => mediaService.listMedia(0, 100),
    refetchInterval: 5000,
  })

  const readyCount = mediaList?.filter((m) => m.status === 'ready').length || 0
  const processingCount = mediaList?.filter((m) => ['processing', 'downloading', 'validating'].includes(m.status)).length || 0

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-app)' }}>
      {/* Top Professional Navigation Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        padding: '0 1.75rem',
        height: '60px',
        backgroundColor: 'var(--bg-surface-glass)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        {/* Brand Logo & Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
          <NavLink to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: 'var(--radius-sm)',
              background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 2px 10px rgba(99, 102, 241, 0.4)',
            }}>
              <Sparkle size={18} weight="fill" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem' }}>
              <span style={{ fontSize: '1.08rem', fontWeight: 700, letterSpacing: '-0.025em', color: 'var(--text-pure)' }}>
                ClipFinder
              </span>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                color: 'var(--text-dim)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                fontFamily: 'JetBrains Mono, monospace',
                padding: '1px 5px',
                borderRadius: '3px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
              }}>
                PRO
              </span>
            </div>
          </NavLink>

          {/* Nav Links */}
          <nav style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            <NavLink
              to="/search"
              style={({ isActive }) => ({
                padding: '0.42rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                fontWeight: isActive ? 600 : 500,
                textDecoration: 'none',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--accent-primary-subtle)' : 'transparent',
                border: isActive ? '1px solid var(--border-active)' : '1px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              })}
            >
              <MagnifyingGlass size={16} weight="bold" />
              <span>Search Moments</span>
            </NavLink>

            <NavLink
              to="/library"
              style={({ isActive }) => ({
                padding: '0.42rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                fontWeight: isActive ? 600 : 500,
                textDecoration: 'none',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                border: isActive ? '1px solid var(--border-medium)' : '1px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              })}
            >
              <FilmStrip size={16} />
              <span>Library</span>
              {readyCount > 0 && (
                <span style={{
                  fontSize: '0.7rem',
                  fontFamily: 'JetBrains Mono, monospace',
                  padding: '1px 5px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-secondary)',
                }}>
                  {readyCount}
                </span>
              )}
            </NavLink>

            <NavLink
              to="/"
              end
              style={({ isActive }) => ({
                padding: '0.42rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.85rem',
                fontWeight: isActive ? 600 : 500,
                textDecoration: 'none',
                color: isActive ? '#fff' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                border: isActive ? '1px solid var(--border-medium)' : '1px solid transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              })}
            >
              <UploadSimple size={16} />
              <span>Ingest</span>
            </NavLink>
          </nav>
        </div>

        {/* Right Status Indicator & Search Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          {processingCount > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.25rem 0.65rem',
              backgroundColor: 'var(--accent-amber-subtle)',
              border: '1px solid var(--accent-amber-border)',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.72rem',
              color: '#fbbf24',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              <Pulse size={14} className="anim-pulse" />
              <span>Indexing {processingCount} video{processingCount > 1 ? 's' : ''}</span>
            </div>
          )}

          <button
            onClick={() => navigate('/search')}
            style={{
              padding: '0.38rem 0.75rem',
              fontSize: '0.78rem',
              backgroundColor: 'var(--bg-surface-1)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <MagnifyingGlass size={14} />
            <span style={{ color: 'var(--text-primary)' }}>Quick Search</span>
            <kbd style={{
              fontSize: '0.65rem',
              fontFamily: 'JetBrains Mono, monospace',
              padding: '1px 4px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '3px',
              color: 'var(--text-dim)',
            }}>
              /
            </kbd>
          </button>
        </div>
      </header>

      {/* Main Viewport */}
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      {/* Professional Footer */}
      <footer style={{
        padding: '1.25rem 2rem',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        backgroundColor: 'var(--bg-surface-0)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}>
        <div>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>ClipFinder</span> — Multimodal Video Search Intelligence & Precision Moment Retrieval
        </div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-dim)', fontSize: '0.7rem' }}>
          Local-First Engine · OpenCLIP ViT-B/32 · ChromaDB · Whisper
        </div>
      </footer>
    </div>
  )
}
