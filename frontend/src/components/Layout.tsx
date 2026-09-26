import { NavLink, Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-app)' }}>
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        padding: '0 2rem',
        height: '60px',
        backgroundColor: 'rgba(9, 11, 17, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <NavLink to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius-sm)',
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '0.85rem',
            color: '#fff',
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.35)',
          }}>
            CF
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
            <span style={{ fontSize: '1.05rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-pure)' }}>
              ClipFinder
            </span>
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-dim)', letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace' }}>
              PRO
            </span>
          </div>
        </NavLink>

        <nav style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          <NavLink
            to="/"
            end
            style={({ isActive }) => ({
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              fontWeight: 500,
              textDecoration: 'none',
              color: isActive ? 'var(--text-pure)' : 'var(--text-secondary)',
              backgroundColor: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              border: isActive ? '1px solid var(--border-medium)' : '1px solid transparent',
              transition: 'all 0.15s ease',
            })}
          >
            Upload
          </NavLink>
          <NavLink
            to="/search"
            style={({ isActive }) => ({
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              fontWeight: 500,
              textDecoration: 'none',
              color: isActive ? '#a5b4fc' : 'var(--text-secondary)',
              backgroundColor: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              border: isActive ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
              transition: 'all 0.15s ease',
            })}
          >
            🔍 Search Moments
          </NavLink>
          <NavLink
            to="/library"
            style={({ isActive }) => ({
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              fontWeight: 500,
              textDecoration: 'none',
              color: isActive ? 'var(--text-pure)' : 'var(--text-secondary)',
              backgroundColor: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              border: isActive ? '1px solid var(--border-medium)' : '1px solid transparent',
              transition: 'all 0.15s ease',
            })}
          >
            Library
          </NavLink>
        </nav>
      </header>

      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      <footer style={{
        padding: '1.25rem 2rem',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        textAlign: 'center',
        backgroundColor: 'var(--bg-surface-0)',
      }}>
        ClipFinder — Local-First Multimodal Video Search Intelligence & Precision Moment Retrieval
      </footer>
    </div>
  )
}
