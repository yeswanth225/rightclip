import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import MediaLibrary from './pages/MediaLibrary'
import MediaDetail from './pages/MediaDetail'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="/library" element={<MediaLibrary />} />
          <Route path="/media/:id" element={<MediaDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
