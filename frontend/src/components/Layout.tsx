import { Link, Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        padding: '1rem 2rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <Link to="/" style={{ textDecoration: 'none', color: '#fff' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>
            ClipFinder
          </h1>
        </Link>
        <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <Link to="/" style={{ color: 'rgba(255, 255, 255, 0.8)', textDecoration: 'none', fontSize: '0.9rem' }}>
            Upload
          </Link>
          <Link to="/search" style={{ color: '#818cf8', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}>
            🔍 Search
          </Link>
          <Link to="/library" style={{ color: 'rgba(255, 255, 255, 0.8)', textDecoration: 'none', fontSize: '0.9rem' }}>
            Library
          </Link>
        </nav>
      </header>

      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      <footer style={{
        padding: '1rem 2rem',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        fontSize: '0.875rem',
        color: 'rgba(255, 255, 255, 0.5)',
      }}>
        <p>ClipFinder v0.1.0 - AI-powered video search and clipping</p>
      </footer>
    </div>
  )
}
