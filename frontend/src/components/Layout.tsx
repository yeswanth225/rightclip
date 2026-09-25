import { Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        padding: '1rem 2rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>
          ClipFinder
        </h1>
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
