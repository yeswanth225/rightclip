import { useParams } from 'react-router-dom'

export default function MediaDetail() {
  const { id } = useParams()

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Media Detail</h2>
      <p>Media ID: {id}</p>
      <p>This page will show media analysis status and search functionality.</p>
    </div>
  )
}
