import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import MediaLibrary from './pages/MediaLibrary'
import MediaDetail from './pages/MediaDetail'
import SearchPage from './pages/SearchPage'
import ClipEditor from './features/clip-editor/ClipEditor'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/library" element={<MediaLibrary />} />
          <Route path="/media/:id" element={<MediaDetail />} />
          <Route path="/media/:id/edit-clip" element={<ClipEditor />} />
          <Route path="/clip-editor/:id" element={<ClipEditor />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App

