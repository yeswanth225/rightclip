import { NavLink, Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        padding: '0.85rem 2rem',
        backgroundColor: 'rgba(9, 10, 15, 0.8)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <NavLink to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1rem',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
          }}>
            C
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>
            ClipFinder
          </span>
        </NavLink>

        <nav style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <NavLink
            to="/"
            end
            style={({ isActive }) => ({
              padding: '0.45rem 0.9rem',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 500,
              textDecoration: 'none',
              color: isActive ? '#fff' : 'rgba(255, 255, 255, 0.65)',
              backgroundColor: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
              transition: 'all 0.15s ease',
            })}
          >
            Upload
          </NavLink>
          <NavLink
            to="/search"
            style={({ isActive }) => ({
              padding: '0.45rem 0.9rem',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 500,
              textDecoration: 'none',
              color: isActive ? '#a5b4fc' : 'rgba(255, 255, 255, 0.65)',
              backgroundColor: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
              border: isActive ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
              transition: 'all 0.15s ease',
            })}
          >
            🔍 AI Search
          </NavLink>
          <NavLink
            to="/library"
            style={({ isActive }) => ({
              padding: '0.45rem 0.9rem',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: 500,
              textDecoration: 'none',
              color: isActive ? '#fff' : 'rgba(255, 255, 255, 0.65)',
              backgroundColor: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
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
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        fontSize: '0.8rem',
        color: 'rgba(255, 255, 255, 0.4)',
        textAlign: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
      }}>
        <p>ClipFinder v0.1.0 — Local AI-Powered Multimodal Video Search & Indexing</p>
      </footer>
    </div>
  )
}
