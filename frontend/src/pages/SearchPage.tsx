import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  MagnifyingGlass,
  Sparkle,
  Lightning,
  ChatCircleText,
  Eye,
  User,
  Image as ImageIcon,
  X,
  Play,
  Pause,
  Scissors,
  DownloadSimple,
  FilmStrip,
  ArrowSquareOut,
  SpinnerGap,
  WarningCircle,
  CheckCircle,
  ArrowsClockwise,
  SkipBack,
  SkipForward,
  CaretLeft,
  CaretRight,
} from '@phosphor-icons/react'
import { mediaService } from '../services/mediaService'
import { getAssetUrl } from '../utils/assets'
import type { UnifiedSearchResult, SearchModeType } from '../types/media'

export default function SearchPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const initialQ = searchParams.get('q') || ''
  const initialMode = (searchParams.get('mode') as SearchModeType) || 'hybrid'
  const initialMediaId = searchParams.get('media_id') ? Number(searchParams.get('media_id')) : undefined

  const [queryInput, setQueryInput] = useState(initialQ)
  const [activeQuery, setActiveQuery] = useState(initialQ)
  const [searchMode, setSearchMode] = useState<SearchModeType>(initialMode)
  const [selectedMediaId, setSelectedMediaId] = useState<number | undefined>(initialMediaId)
  const [selectedResult, setSelectedResult] = useState<UnifiedSearchResult | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoopingMoment, setIsLoopingMoment] = useState(false)
  const [videoCurrentTime, setVideoCurrentTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1.0)
  const [exportMessage, setExportMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Reference Image state
  const [referenceImageB64, setReferenceImageB64] = useState<string | null>(null)
  const [referenceImageName, setReferenceImageName] = useState<string>('')
  const [isDraggingFile, setIsDraggingFile] = useState(false)

  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const timelineBarRef = useRef<HTMLDivElement | null>(null)

  // Sync state if URL params change
  useEffect(() => {
    const q = searchParams.get('q') || ''
    const m = (searchParams.get('mode') as SearchModeType) || 'hybrid'
    const mid = searchParams.get('media_id') ? Number(searchParams.get('media_id')) : undefined
    if (q !== activeQuery) {
      setQueryInput(q)
      setActiveQuery(q)
    }
    if (m !== searchMode) setSearchMode(m)
    if (mid !== selectedMediaId) setSelectedMediaId(mid)
  }, [searchParams])

  // Global Keyboard Shortcuts (Ctrl+K or / to search, Space to toggle video, J/L for seeking, Esc to blur)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement | null
      const isInputActive = activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName)

      if ((e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key === 'k')) && !isInputActive) {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      } else if (e.key === 'Escape' && isInputActive) {
        searchInputRef.current?.blur()
      } else if (e.code === 'Space' && !isInputActive && selectedResult && videoRef.current) {
        e.preventDefault()
        if (videoRef.current.paused) {
          videoRef.current.play().catch(() => {})
          setIsPlaying(true)
        } else {
          videoRef.current.pause()
          setIsPlaying(false)
        }
      } else if (!isInputActive && selectedResult && videoRef.current) {
        if (e.key === 'j' || e.key === 'J') {
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 1)
        } else if (e.key === 'l' || e.key === 'L') {
          videoRef.current.currentTime = Math.min(videoRef.current.duration || 9999, videoRef.current.currentTime + 1)
        } else if (e.key === 'k' || e.key === 'K') {
          if (videoRef.current.paused) {
            videoRef.current.play().catch(() => {})
            setIsPlaying(true)
          } else {
            videoRef.current.pause()
            setIsPlaying(false)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedResult])

  // Query search execution
  const hasValidQuery = !!activeQuery.trim() || !!referenceImageB64

  const { data: searchData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['search', activeQuery, searchMode, selectedMediaId, referenceImageB64],
    queryFn: () => mediaService.searchUnified(
      activeQuery,
      selectedMediaId,
      searchMode,
      30,
      referenceImageB64 || undefined
    ),
    enabled: hasValidQuery,
    staleTime: 30000,
  })

  const { data: mediaList } = useQuery({
    queryKey: ['media'],
    queryFn: () => mediaService.listMedia(0, 100),
  })

  // Auto-select first result on new search results
  useEffect(() => {
    if (searchData && searchData.results && searchData.results.length > 0) {
      if (!selectedResult || !searchData.results.some((r) => r.media_id === selectedResult.media_id && r.start_time === selectedResult.start_time)) {
        const topResult = searchData.results[0]
        setSelectedResult(topResult)
        if (videoRef.current) {
          videoRef.current.currentTime = topResult.representative_timestamp
        }
      }
    }
  }, [searchData])

  // Export moment mutation
  const exportMutation = useMutation({
    mutationFn: (result: UnifiedSearchResult) =>
      mediaService.exportMoment(
        result.media_id,
        result.start_time,
        result.end_time,
        `Clip_${result.media_filename.replace(/\.[^/.]+$/, '')}_${result.start_time}s`
      ),
    onSuccess: (data) => {
      setExportMessage({ text: `✓ MP4 clip exported successfully (${data.duration}s). Downloading...`, type: 'success' })
      const a = document.createElement('a')
      a.href = data.download_url
      a.download = `clip_${data.media_id}_${data.start_time}s_${data.end_time}s.mp4`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => setExportMessage(null), 5000)
    },
    onError: (err: any) => {
      setExportMessage({ text: `Export failed: ${err?.response?.data?.detail || err.message}`, type: 'error' })
      setTimeout(() => setExportMessage(null), 5000)
    },
  })

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (queryInput.trim() || referenceImageB64) {
      const q = queryInput.trim()
      setActiveQuery(q)
      setSearchParams({
        ...(q ? { q } : {}),
        mode: searchMode,
        ...(selectedMediaId ? { media_id: String(selectedMediaId) } : {}),
      })
    }
  }

  const handleProcessImageFile = (file: File) => {
    setReferenceImageName(file.name)
    const reader = new FileReader()
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result as string
      setReferenceImageB64(result)
      if (searchMode !== 'person' && searchMode !== 'visual') {
        setSearchMode('person')
      }
    }
    reader.readAsDataURL(file)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleProcessImageFile(file)
    }
  }

  const handleRemoveImage = () => {
    setReferenceImageB64(null)
    setReferenceImageName('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '00:00.0'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 10)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`
  }

  const handleSeek = (result: UnifiedSearchResult) => {
    setSelectedResult(result)
    setIsPlaying(true)
    if (videoRef.current) {
      videoRef.current.currentTime = result.representative_timestamp
      videoRef.current.play().catch(() => {})
    }
  }

  const handleVideoTimeUpdate = () => {
    if (!videoRef.current) return
    const cur = videoRef.current.currentTime
    setVideoCurrentTime(cur)
    if (videoRef.current.duration) {
      setVideoDuration(videoRef.current.duration)
    }

    if (selectedResult && isLoopingMoment) {
      if (cur >= selectedResult.end_time || cur < selectedResult.start_time) {
        videoRef.current.currentTime = selectedResult.start_time
        videoRef.current.play().catch(() => {})
      }
    }
  }

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineBarRef.current || !videoRef.current) return
    const rect = timelineBarRef.current.getBoundingClientRect()
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const ratio = clickX / rect.width
    const dur = videoDuration || selectedResult?.end_time || 1
    const newTime = ratio * dur
    videoRef.current.currentTime = newTime
    setVideoCurrentTime(newTime)
  }

  const handleStepFrame = (deltaSeconds: number) => {
    if (!videoRef.current) return
    const target = Math.max(0, Math.min(videoDuration || 9999, videoRef.current.currentTime + deltaSeconds))
    videoRef.current.currentTime = target
    setVideoCurrentTime(target)
  }

  const activeMedia = selectedResult
    ? (mediaList || []).find((m) => m.id === selectedResult.media_id)
    : null

  const proxyUrl = getAssetUrl(activeMedia?.proxy_path || activeMedia?.file_path)

  const modes: { id: SearchModeType; label: string; desc: string; icon: any }[] = [
    { id: 'hybrid', label: 'Everything (Fusion)', desc: 'Cross-modal fusion across speech, actions, visuals & faces', icon: Sparkle },
    { id: 'action', label: 'Actions & Events', desc: 'Detects physical motion, transitions & scene actions', icon: Lightning },
    { id: 'dialogue', label: 'Spoken Dialogue', desc: 'Speech-to-text exact phrase & semantic dialogue retrieval', icon: ChatCircleText },
    { id: 'visual', label: 'Visual Scenes', desc: 'OpenCLIP visual semantic appearance & object vectors', icon: Eye },
    { id: 'person', label: 'Person Reference', desc: 'Face & character matching from reference photo', icon: User },
  ]

  const suggestedQueries = [
    { text: 'the character walks into the room', mode: 'action' as const, category: 'Action Query' },
    { text: 'he picks up the phone', mode: 'action' as const, category: 'Action Query' },
    { text: '"we need to leave now"', mode: 'dialogue' as const, category: 'Dialogue Quote' },
    { text: 'blue car at night', mode: 'visual' as const, category: 'Visual Scene' },
    { text: 'person standing near a building', mode: 'visual' as const, category: 'Visual Scene' },
  ]

  // Timeline proportions calculation
  const effectiveDuration = videoDuration > 0 ? videoDuration : (selectedResult ? Math.max(selectedResult.end_time, 20) : 1)
  const momentStartPercent = selectedResult ? (selectedResult.start_time / effectiveDuration) * 100 : 0
  const momentWidthPercent = selectedResult ? ((selectedResult.end_time - selectedResult.start_time) / effectiveDuration) * 100 : 0
  const currentPlayheadPercent = (videoCurrentTime / effectiveDuration) * 100

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '1.75rem 1.5rem 5rem' }}>
      {/* Search Command Header Bar */}
      <div style={{ marginBottom: '1.75rem' }}>
        <form onSubmit={handleSearchSubmit}>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDraggingFile(true)
            }}
            onDragLeave={() => setIsDraggingFile(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDraggingFile(false)
              if (e.dataTransfer.files?.[0]) {
                handleProcessImageFile(e.dataTransfer.files[0])
              }
            }}
            style={{
              backgroundColor: 'var(--bg-surface-0)',
              border: isDraggingFile ? '1px dashed var(--accent-purple)' : '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
              padding: '0.85rem 1.15rem',
              boxShadow: 'var(--shadow-md)',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            {/* Reference Image Attachment Tray if active */}
            {referenceImageB64 && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.65rem',
                backgroundColor: 'var(--accent-purple-subtle)',
                border: '1px solid var(--accent-purple-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.35rem 0.65rem',
                marginBottom: '0.75rem',
              }}>
                <img
                  src={referenceImageB64}
                  alt="Reference"
                  style={{ width: '28px', height: '28px', borderRadius: '4px', objectFit: 'cover' }}
                />
                <span style={{ fontSize: '0.78rem', color: '#c084fc', fontWeight: 600 }}>
                  Reference Photo: {referenceImageName || 'Selected Photo'}
                </span>
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  style={{
                    background: 'transparent',
                    color: 'rgba(255, 255, 255, 0.6)',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Remove reference photo"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <MagnifyingGlass size={20} color="var(--text-muted)" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={
                  referenceImageB64
                    ? "Describe action or event with this person, or press Enter to find all appearances..."
                    : "Search actions ('character walks into the room'), dialogue ('\"we need to leave\"'), or visuals ('blue car at night')..."
                }
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-pure)',
                  fontSize: '1rem',
                  padding: '0.35rem 0',
                }}
              />

              {queryInput && (
                <button
                  type="button"
                  onClick={() => {
                    setQueryInput('')
                    searchInputRef.current?.focus()
                  }}
                  style={{
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Clear query [Esc]"
                >
                  <X size={16} />
                </button>
              )}

              {/* Media Filter Selector */}
              {mediaList && mediaList.length > 1 && (
                <select
                  value={selectedMediaId || ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : undefined
                    setSelectedMediaId(val)
                    if (activeQuery) {
                      setSearchParams({
                        q: activeQuery,
                        mode: searchMode,
                        ...(val ? { media_id: String(val) } : {}),
                      })
                    }
                  }}
                  style={{
                    backgroundColor: 'var(--bg-surface-1)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '0.45rem 0.65rem',
                    fontSize: '0.8rem',
                    maxWidth: '180px',
                  }}
                  title="Filter search to a specific video"
                >
                  <option value="">All Videos ({mediaList.length})</option>
                  {mediaList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.filename}
                    </option>
                  ))}
                </select>
              )}

              {/* Reference Photo Upload Button */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  padding: '0.45rem 0.8rem',
                  fontSize: '0.8rem',
                  backgroundColor: referenceImageB64 ? 'var(--accent-purple-subtle)' : 'var(--bg-surface-1)',
                  color: referenceImageB64 ? '#c084fc' : 'var(--text-secondary)',
                  border: referenceImageB64 ? '1px solid var(--accent-purple-border)' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
                title="Search moments using a reference photo"
              >
                <ImageIcon size={15} />
                <span>{referenceImageB64 ? 'Change Photo' : 'Add Photo Ref'}</span>
              </button>

              {/* Search Submit Button */}
              <button
                type="submit"
                style={{
                  padding: '0.45rem 1.15rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--accent-primary)',
                  color: '#fff',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                {isLoading ? <SpinnerGap size={16} className="anim-spin" /> : <MagnifyingGlass size={16} />}
                <span>Search</span>
              </button>
            </div>
          </div>

          {/* Search Retrieval Modes Selector Tabs */}
          <div style={{
            display: 'flex',
            gap: '0.45rem',
            marginTop: '0.85rem',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginRight: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Mode:
            </span>
            {modes.map((mode) => {
              const Icon = mode.icon
              const isActive = searchMode === mode.id
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    setSearchMode(mode.id)
                    if (activeQuery) {
                      setSearchParams({
                        q: activeQuery,
                        mode: mode.id,
                        ...(selectedMediaId ? { media_id: String(selectedMediaId) } : {}),
                      })
                    }
                  }}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.78rem',
                    fontWeight: isActive ? 600 : 500,
                    backgroundColor: isActive ? 'var(--accent-primary-subtle)' : 'var(--bg-surface-0)',
                    color: isActive ? '#fff' : 'var(--text-secondary)',
                    border: isActive ? '1px solid var(--border-active)' : '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                  title={mode.desc}
                >
                  <Icon size={14} weight={isActive ? 'fill' : 'regular'} />
                  <span>{mode.label}</span>
                </button>
              )
            })}
          </div>
        </form>
      </div>

      {/* Export Status Notification */}
      {exportMessage && (
        <div style={{
          padding: '0.75rem 1.25rem',
          backgroundColor: exportMessage.type === 'success' ? 'var(--accent-emerald-subtle)' : 'var(--accent-rose-subtle)',
          border: `1px solid ${exportMessage.type === 'success' ? 'var(--accent-emerald-border)' : 'var(--accent-rose-border)'}`,
          borderRadius: 'var(--radius-md)',
          color: exportMessage.type === 'success' ? '#34d399' : '#fb7185',
          fontSize: '0.85rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          boxShadow: 'var(--shadow-md)',
        }}>
          {exportMessage.type === 'success' ? <CheckCircle size={18} weight="bold" /> : <WarningCircle size={18} weight="bold" />}
          <span>{exportMessage.text}</span>
        </div>
      )}

      {/* Main Synchronized Video Inspector Workspace */}
      {selectedResult && (
        <div style={{
          backgroundColor: 'var(--bg-surface-0)',
          border: '1px solid var(--border-active)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem',
          marginBottom: '2rem',
          boxShadow: 'var(--shadow-lg)',
        }}>
          {/* Header & Meta Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.85rem',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-pure)' }}>
                  {selectedResult.media_filename}
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  backgroundColor: 'var(--accent-primary-subtle)',
                  color: '#a5b4fc',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: 'var(--radius-sm)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontWeight: 600,
                }}>
                  Moment: {formatTime(selectedResult.start_time)} – {formatTime(selectedResult.end_time)} ({((selectedResult.end_time - selectedResult.start_time)).toFixed(1)}s)
                </span>
                {selectedResult.scene_index !== undefined && selectedResult.scene_index !== null && (
                  <span style={{
                    fontSize: '0.72rem',
                    padding: '2px 6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-secondary)',
                    borderRadius: 'var(--radius-xs)',
                  }}>
                    Scene #{selectedResult.scene_index + 1}
                  </span>
                )}
                {isPlaying && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.72rem',
                    color: 'var(--accent-emerald)',
                    padding: '2px 6px',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    borderRadius: 'var(--radius-xs)',
                    fontWeight: 600,
                  }}>
                    ● Playing
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                {selectedResult.evidence.explanation}
              </p>
            </div>

            {/* Quick Actions Bar */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => setIsLoopingMoment(!isLoopingMoment)}
                style={{
                  padding: '0.45rem 0.8rem',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  backgroundColor: isLoopingMoment ? 'var(--accent-cyan-subtle)' : 'rgba(255, 255, 255, 0.06)',
                  color: isLoopingMoment ? '#22d3ee' : 'var(--text-secondary)',
                  border: isLoopingMoment ? '1px solid var(--accent-cyan-border)' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
                title="Loop playback inside matched boundary"
              >
                <ArrowsClockwise size={15} />
                <span>{isLoopingMoment ? 'Looping Moment' : 'Loop Moment'}</span>
              </button>

              <button
                onClick={() => exportMutation.mutate(selectedResult)}
                disabled={exportMutation.isPending}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
                title="Export this sub-clip as MP4 video"
              >
                <DownloadSimple size={15} />
                <span>{exportMutation.isPending ? 'Exporting...' : 'Export MP4'}</span>
              </button>

              <button
                onClick={() => navigate(`/media/${selectedResult.media_id}/edit-clip`, {
                  state: {
                    searchResult: selectedResult,
                    initialStart: selectedResult.start_time,
                    initialEnd: selectedResult.end_time,
                    searchQuery: activeQuery,
                  },
                })}
                style={{
                  padding: '0.45rem 0.95rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--accent-primary)',
                  color: '#fff',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <Scissors size={15} />
                <span>Trim in Editor</span>
              </button>

              <button
                onClick={() => navigate(`/media/${selectedResult.media_id}`)}
                style={{
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.82rem',
                  backgroundColor: 'var(--bg-surface-1)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Inspect full video analysis and transcripts"
              >
                <ArrowSquareOut size={15} />
              </button>
            </div>
          </div>

          {/* Video Player Display */}
          {proxyUrl ? (
            <div>
              <video
                ref={videoRef}
                src={proxyUrl}
                autoPlay
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={handleVideoTimeUpdate}
                onLoadedMetadata={() => {
                  if (videoRef.current) {
                    setVideoDuration(videoRef.current.duration)
                    videoRef.current.currentTime = selectedResult.representative_timestamp
                  }
                }}
                style={{
                  width: '100%',
                  maxHeight: '460px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#000',
                  display: 'block',
                }}
              />

              {/* Interactive Precision Moment Timeline */}
              <div style={{ marginTop: '0.85rem' }}>
                {/* Timeline bar with moment overlay */}
                <div
                  ref={timelineBarRef}
                  onClick={handleTimelineClick}
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '24px',
                    backgroundColor: 'var(--bg-surface-2)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-medium)',
                    cursor: 'pointer',
                    overflow: 'hidden',
                  }}
                  title="Click to scrub through video timeline"
                >
                  {/* Highlighted Moment Window Band */}
                  <div
                    style={{
                      position: 'absolute',
                      left: `${momentStartPercent}%`,
                      width: `${momentWidthPercent}%`,
                      top: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(99, 102, 241, 0.35)',
                      borderLeft: '2px solid #818cf8',
                      borderRight: '2px solid #818cf8',
                      boxShadow: '0 0 10px rgba(99, 102, 241, 0.4)',
                    }}
                  />

                  {/* Playhead Indicator Needle */}
                  <div
                    style={{
                      position: 'absolute',
                      left: `${Math.min(100, Math.max(0, currentPlayheadPercent))}%`,
                      top: 0,
                      bottom: 0,
                      width: '3px',
                      backgroundColor: '#fff',
                      boxShadow: '0 0 6px rgba(255, 255, 255, 0.9)',
                      zIndex: 10,
                      transform: 'translateX(-50%)',
                    }}
                  />
                </div>

                {/* Timeline Transport Controls & Readout */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '0.6rem',
                  fontSize: '0.78rem',
                  fontFamily: 'JetBrains Mono, monospace',
                  color: 'var(--text-secondary)',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}>
                  {/* Left Transport buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (videoRef.current) {
                          if (videoRef.current.paused) {
                            videoRef.current.play().catch(() => {})
                            setIsPlaying(true)
                          } else {
                            videoRef.current.pause()
                            setIsPlaying(false)
                          }
                        }
                      }}
                      style={{
                        padding: '0.3rem 0.65rem',
                        backgroundColor: 'var(--accent-primary-subtle)',
                        color: '#a5b4fc',
                        borderRadius: 'var(--radius-xs)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                      title="Toggle Play / Pause [Space]"
                    >
                      {isPlaying ? <Pause size={13} weight="fill" /> : <Play size={13} weight="fill" />}
                      <span>{isPlaying ? 'Pause' : 'Play'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (videoRef.current) {
                          videoRef.current.currentTime = selectedResult.start_time
                          setVideoCurrentTime(selectedResult.start_time)
                        }
                      }}
                      style={{
                        padding: '0.3rem 0.55rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--text-secondary)',
                        borderRadius: 'var(--radius-xs)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Jump to Moment Start"
                    >
                      <SkipBack size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStepFrame(-1)}
                      style={{
                        padding: '0.3rem 0.55rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--text-secondary)',
                        borderRadius: 'var(--radius-xs)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Step -1 sec [J]"
                    >
                      <CaretLeft size={13} />
                      <span style={{ fontSize: '0.7rem' }}>-1s</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStepFrame(1)}
                      style={{
                        padding: '0.3rem 0.55rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--text-secondary)',
                        borderRadius: 'var(--radius-xs)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Step +1 sec [L]"
                    >
                      <span style={{ fontSize: '0.7rem' }}>+1s</span>
                      <CaretRight size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (videoRef.current) {
                          videoRef.current.currentTime = selectedResult.end_time
                          setVideoCurrentTime(selectedResult.end_time)
                        }
                      }}
                      style={{
                        padding: '0.3rem 0.55rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--text-secondary)',
                        borderRadius: 'var(--radius-xs)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Jump to Moment End"
                    >
                      <SkipForward size={13} />
                    </button>
                  </div>

                  {/* Playhead Status Indicator */}
                  <div>
                    <span style={{ color: 'var(--text-pure)', fontWeight: 600 }}>{formatTime(videoCurrentTime)}</span>
                    <span style={{ color: 'var(--text-dim)' }}> / {formatTime(videoDuration)}</span>
                    <span style={{ marginLeft: '0.75rem', color: '#a5b4fc', fontSize: '0.72rem' }}>
                      [Moment: {formatTime(selectedResult.start_time)} – {formatTime(selectedResult.end_time)}]
                    </span>
                  </div>

                  {/* Playback speed selector */}
                  <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>Speed:</span>
                    {[0.5, 1.0, 1.5, 2.0].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => {
                          setPlaybackRate(rate)
                          if (videoRef.current) videoRef.current.playbackRate = rate
                        }}
                        style={{
                          padding: '2px 5px',
                          fontSize: '0.7rem',
                          backgroundColor: playbackRate === rate ? 'var(--accent-primary-subtle)' : 'transparent',
                          color: playbackRate === rate ? '#818cf8' : 'var(--text-dim)',
                          border: playbackRate === rate ? '1px solid var(--border-active)' : '1px solid transparent',
                          borderRadius: '3px',
                        }}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              Proxy video stream unavailable for preview.
            </div>
          )}
        </div>
      )}

      {/* Latency & Metrics Bar */}
      {searchData && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.65rem 1rem',
          backgroundColor: 'var(--bg-surface-0)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '1.25rem',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}>
          <div>
            Retrieved <strong style={{ color: 'var(--text-pure)' }}>{searchData.total_results}</strong> moment{searchData.total_results === 1 ? '' : 's'} for <span style={{ color: '#a5b4fc' }}>"{searchData.query}"</span>
          </div>
          <div style={{ display: 'flex', gap: '1rem', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>
            <span>Total: <strong style={{ color: '#818cf8' }}>{searchData.latency_ms}ms</strong></span>
            <span>Speech: {searchData.transcript_latency_ms}ms</span>
            <span>Vision: {searchData.visual_latency_ms}ms</span>
            {searchData.person_latency_ms !== undefined && searchData.person_latency_ms > 0 && (
              <span>Person: {searchData.person_latency_ms}ms</span>
            )}
          </div>
        </div>
      )}

      {/* Initial Landing State when no query is active */}
      {!hasValidQuery && (
        <div style={{
          backgroundColor: 'var(--bg-surface-0)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '2.5rem 2rem',
          textAlign: 'center',
          maxWidth: '860px',
          margin: '2rem auto',
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: 'var(--accent-primary-subtle)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#a5b4fc',
            margin: '0 auto 1.25rem',
          }}>
            <Sparkle size={24} weight="fill" />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-pure)', marginBottom: '0.5rem' }}>
            Search Video by Action, Speech, Visuals, or Photo
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '580px', margin: '0 auto 1.75rem', lineHeight: 1.6 }}>
            Type natural language descriptions to find exact video moments with sub-second precision.
          </p>

          <div style={{ textAlign: 'left', maxWidth: '640px', margin: '0 auto' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.65rem' }}>
              Suggested Prompt Examples
            </div>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {suggestedQueries.map((item) => (
                <button
                  key={item.text}
                  type="button"
                  onClick={() => {
                    setQueryInput(item.text)
                    setActiveQuery(item.text)
                    setSearchMode(item.mode)
                    setSearchParams({ q: item.text, mode: item.mode })
                  }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.65rem 1rem',
                    backgroundColor: 'var(--bg-surface-1)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    textAlign: 'left',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    transition: 'border-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-active)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                >
                  <span>{item.text}</span>
                  <span style={{
                    fontSize: '0.72rem',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: 'var(--text-dim)',
                  }}>
                    {item.category}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Shimmering Loading Skeleton */}
      {isLoading && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              style={{
                height: '130px',
                backgroundColor: 'var(--bg-surface-0)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                display: 'grid',
                gridTemplateColumns: '220px 1fr auto',
                gap: '1.25rem',
              }}
            >
              <div className="skeleton-box" style={{ width: '100%', height: '100%' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div className="skeleton-box" style={{ width: '60%', height: '18px' }} />
                <div className="skeleton-box" style={{ width: '90%', height: '14px' }} />
                <div className="skeleton-box" style={{ width: '40%', height: '14px' }} />
              </div>
              <div className="skeleton-box" style={{ width: '80px', height: '100%' }} />
            </div>
          ))}
        </div>
      )}

      {/* Error Recovery State */}
      {isError && (
        <div style={{
          padding: '1.25rem',
          backgroundColor: 'var(--accent-rose-subtle)',
          border: '1px solid var(--accent-rose-border)',
          borderRadius: 'var(--radius-md)',
          color: '#fb7185',
          marginBottom: '1.5rem',
          fontSize: '0.88rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}>
          <WarningCircle size={24} weight="bold" />
          <div style={{ flex: 1 }}>
            <strong>Search failed:</strong> {String(error)}
          </div>
          <button
            onClick={() => refetch()}
            style={{
              padding: '0.35rem 0.75rem',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: '#fff',
              borderRadius: 'var(--radius-xs)',
              fontSize: '0.78rem',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {searchData && searchData.results.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '4rem 2rem',
          backgroundColor: 'var(--bg-surface-0)',
          border: '1px dashed var(--border-strong)',
          borderRadius: 'var(--radius-lg)',
          maxWidth: '600px',
          margin: '2rem auto',
        }}>
          <div style={{ color: 'var(--text-dim)', marginBottom: '0.75rem' }}>
            <MagnifyingGlass size={36} />
          </div>
          <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-pure)', marginBottom: '0.35rem' }}>
            No matching video moments found
          </p>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
            Try broader terms, switch retrieval modes (e.g. from Spoken Dialogue to Actions or Everything), or attach a clearer reference photo.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {suggestedQueries.slice(0, 3).map((item) => (
              <button
                key={item.text}
                type="button"
                onClick={() => {
                  setQueryInput(item.text)
                  setActiveQuery(item.text)
                  setSearchMode(item.mode)
                  setSearchParams({ q: item.text, mode: item.mode })
                }}
                style={{
                  padding: '0.25rem 0.65rem',
                  fontSize: '0.75rem',
                  backgroundColor: 'var(--bg-surface-1)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-pill)',
                }}
              >
                Try: {item.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ranked Video Moments Result List */}
      {searchData && searchData.results.length > 0 && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {searchData.results.map((result, idx) => {
            const thumbUrl = getAssetUrl(result.thumbnail_path)
            const isSelected = selectedResult?.media_id === result.media_id && selectedResult?.start_time === result.start_time
            const matchBadges = result.evidence.match_types || []

            return (
              <div
                key={`${result.media_id}-${result.start_time}-${idx}`}
                onClick={() => handleSeek(result)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '220px 1fr auto',
                  gap: '1.25rem',
                  backgroundColor: isSelected ? 'var(--accent-primary-subtle)' : 'var(--bg-surface-0)',
                  border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-strong)'
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-subtle)'
                }}
              >
                {/* 16:9 Thumbnail Card */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: '124px',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                  backgroundColor: '#000',
                }}>
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt="Moment Thumbnail"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
                      <FilmStrip size={32} />
                    </div>
                  )}

                  {/* Representative timestamp pill */}
                  <div style={{
                    position: 'absolute',
                    bottom: '6px',
                    right: '6px',
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.72rem',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: '#fff',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}>
                    <Play size={10} weight="fill" color="#818cf8" />
                    <span>{formatTime(result.representative_timestamp)}</span>
                  </div>
                </div>

                {/* Content & Evidence Breakdown */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    {/* Header line with filename, scene, range, and modality tags */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.45rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-pure)' }}>
                        {result.media_filename}
                      </span>
                      {result.scene_index !== undefined && result.scene_index !== null && (
                        <span style={{
                          fontSize: '0.72rem',
                          padding: '1px 6px',
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          color: 'var(--text-secondary)',
                          borderRadius: '4px',
                        }}>
                          Scene #{result.scene_index + 1}
                        </span>
                      )}
                      <span style={{
                        fontSize: '0.75rem',
                        fontFamily: 'JetBrains Mono, monospace',
                        color: 'var(--accent-cyan)',
                        fontWeight: 600,
                      }}>
                        {formatTime(result.start_time)} – {formatTime(result.end_time)} ({((result.end_time - result.start_time)).toFixed(1)}s)
                      </span>

                      {/* Evidence Modality Badges */}
                      <div style={{ display: 'flex', gap: '0.3rem', marginLeft: 'auto' }}>
                        {matchBadges.map((tag) => (
                          <span
                            key={tag}
                            className={`badge-tag badge-${tag}`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Dialogue Quote if available */}
                    {result.evidence.transcript_text && (
                      <div style={{
                        fontSize: '0.85rem',
                        color: 'var(--text-primary)',
                        marginBottom: '0.4rem',
                        fontStyle: 'italic',
                        borderLeft: '2px solid var(--accent-cyan)',
                        paddingLeft: '0.65rem',
                      }}>
                        "{result.evidence.transcript_text}"
                      </div>
                    )}

                    {/* Concise Evidence Explanation */}
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {result.evidence.explanation}
                    </div>
                  </div>
                </div>

                {/* Score & Direct Moment Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', minWidth: '130px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Match Score
                    </div>
                    <div style={{
                      fontSize: '1.25rem',
                      fontWeight: 700,
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#818cf8',
                    }}>
                      {result.score.toFixed(3)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSeek(result)
                      }}
                      style={{
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.75rem',
                        backgroundColor: 'var(--accent-primary-subtle)',
                        color: '#a5b4fc',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <Play size={12} weight="fill" />
                      <span>Seek</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        exportMutation.mutate(result)
                      }}
                      style={{
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.75rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                      title="Export this moment as MP4 video"
                    >
                      <DownloadSimple size={12} />
                      <span>Export</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/media/${result.media_id}/edit-clip`, {
                          state: {
                            searchResult: result,
                            initialStart: result.start_time,
                            initialEnd: result.end_time,
                            searchQuery: activeQuery,
                          },
                        })
                      }}
                      style={{
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.75rem',
                        backgroundColor: 'rgba(255, 255, 255, 0.06)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <Scissors size={12} />
                      <span>Trim</span>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
