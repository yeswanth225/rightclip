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
  Scissors,
  DownloadSimple,
  FilmStrip,
  ArrowSquareOut,
  SpinnerGap,
  WarningCircle,
  CheckCircle,
  ArrowsClockwise,
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
  const [exportMessage, setExportMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Reference Image state
  const [referenceImageB64, setReferenceImageB64] = useState<string | null>(null)
  const [referenceImageName, setReferenceImageName] = useState<string>('')
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

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

  // Global Keyboard Shortcuts (Ctrl+K or / to focus search, Space to toggle video playback)
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
      setExportMessage({ text: `✓ MP4 clip exported (${data.duration}s). Downloading...`, type: 'success' })
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
      setSelectedResult(null)
      setSearchParams({
        ...(q ? { q } : {}),
        mode: searchMode,
        ...(selectedMediaId ? { media_id: String(selectedMediaId) } : {}),
      })
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setReferenceImageName(file.name)
      const reader = new FileReader()
      reader.onload = (uploadEvent) => {
        const result = uploadEvent.target?.result as string
        setReferenceImageB64(result)
        if (!queryInput.trim()) {
          setSearchMode('person')
        }
      }
      reader.readAsDataURL(file)
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
    if (!videoRef.current || !selectedResult || !isLoopingMoment) return
    const cur = videoRef.current.currentTime
    if (cur >= selectedResult.end_time || cur < selectedResult.start_time) {
      videoRef.current.currentTime = selectedResult.start_time
      videoRef.current.play().catch(() => {})
    }
  }

  const activeMedia = selectedResult
    ? (mediaList || []).find((m) => m.id === selectedResult.media_id)
    : null

  const proxyUrl = getAssetUrl(activeMedia?.proxy_path || activeMedia?.file_path)

  const modes: { id: SearchModeType; label: string; desc: string; icon: any }[] = [
    { id: 'hybrid', label: 'Everything (Fusion)', desc: 'Cross-modal fusion across dialogue, actions, visuals & faces', icon: Sparkle },
    { id: 'action', label: 'Actions & Events', desc: 'Detects physical motion, transitions & scene events', icon: Lightning },
    { id: 'dialogue', label: 'Spoken Dialogue', desc: 'Speech-to-text exact & semantic dialogue matching', icon: ChatCircleText },
    { id: 'visual', label: 'Visual Scenes', desc: 'OpenCLIP visual semantic appearance & object vectors', icon: Eye },
    { id: 'person', label: 'Person Reference', desc: 'Face & appearance matching from reference photo', icon: User },
  ]

  const suggestedQueries = [
    { text: 'the character walks into the room', mode: 'action' as const },
    { text: 'he picks up the phone', mode: 'action' as const },
    { text: '"we need to leave now"', mode: 'dialogue' as const },
    { text: 'blue car at night', mode: 'visual' as const },
    { text: 'person standing near a building', mode: 'visual' as const },
  ]

  return (
    <div style={{ maxWidth: '1360px', margin: '0 auto', padding: '2.5rem 1.5rem 5rem' }}>
      {/* Search Header Workspace */}
      <div style={{ marginBottom: '2.5rem', maxWidth: '960px', margin: '0 auto 2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.25rem 0.75rem',
            backgroundColor: 'var(--accent-primary-subtle)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: 'var(--radius-pill)',
            color: '#a5b4fc',
            fontSize: '0.72rem',
            fontWeight: 600,
            marginBottom: '0.75rem',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            <Sparkle size={14} weight="fill" />
            <span>AI Multimodal Video Moment Retrieval</span>
          </div>

          <h1 style={{
            fontSize: '2.25rem',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: 'var(--text-pure)',
            marginBottom: '0.4rem',
          }}>
            Search Video Moments
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '600px', margin: '0 auto' }}>
            Find exact video scenes by describing actions, quoting dialogue, detailing visual concepts, or providing a reference photo.
          </p>
        </div>

        {/* Primary Search Command Bar */}
        <form onSubmit={handleSearchSubmit}>
          <div style={{
            backgroundColor: 'var(--bg-surface-0)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-lg)',
            padding: '0.85rem 1.15rem',
            boxShadow: 'var(--shadow-md)',
            transition: 'border-color 0.15s ease',
          }}>
            {/* Reference Image Badge if attached */}
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
                    ? "e.g. 'when this character enters the room' (or leave empty for all appearances)"
                    : "Search actions ('character walks into the room'), dialogue ('\"we need to leave\"'), or visuals ('blue car at night')"
                }
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-pure)',
                  fontSize: '1.02rem',
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
                  }}
                  title="Clear input [Esc]"
                >
                  <X size={16} />
                </button>
              )}

              {/* Media Filter Selector */}
              {mediaList && mediaList.length > 1 && (
                <select
                  value={selectedMediaId || ''}
                  onChange={(e) => setSelectedMediaId(e.target.value ? Number(e.target.value) : undefined)}
                  style={{
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.78rem',
                    backgroundColor: 'var(--bg-surface-1)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-secondary)',
                    maxWidth: '160px',
                    cursor: 'pointer',
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

              {/* Reference Image Picker */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach reference image or face photo"
                style={{
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  backgroundColor: referenceImageB64 ? 'var(--accent-purple-subtle)' : 'rgba(255, 255, 255, 0.05)',
                  color: referenceImageB64 ? '#c084fc' : 'var(--text-secondary)',
                  border: referenceImageB64 ? '1px solid var(--accent-purple-border)' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <ImageIcon size={16} />
                <span>{referenceImageB64 ? 'Change Ref' : '+ Ref Photo'}</span>
              </button>

              <button
                type="submit"
                disabled={isLoading || (!queryInput.trim() && !referenceImageB64)}
                style={{
                  padding: '0.55rem 1.35rem',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--accent-primary)',
                  color: '#fff',
                  borderRadius: 'var(--radius-sm)',
                  opacity: isLoading || (!queryInput.trim() && !referenceImageB64) ? 0.6 : 1,
                  boxShadow: '0 2px 10px rgba(99, 102, 241, 0.3)',
                }}
              >
                {isLoading ? (
                  <>
                    <SpinnerGap size={16} className="anim-pulse" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <span>Search</span>
                )}
              </button>
            </div>
          </div>

          {/* Mode Selector Chips */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.5rem',
            marginTop: '1rem',
            flexWrap: 'wrap',
          }}>
            {modes.map((m) => {
              const active = searchMode === m.id
              const IconComp = m.icon
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSearchMode(m.id)}
                  style={{
                    padding: '0.38rem 0.85rem',
                    fontSize: '0.78rem',
                    fontWeight: active ? 600 : 500,
                    color: active ? 'var(--text-pure)' : 'var(--text-secondary)',
                    backgroundColor: active ? 'var(--accent-primary-subtle)' : 'var(--bg-surface-0)',
                    border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-pill)',
                    gap: '0.35rem',
                  }}
                  title={m.desc}
                >
                  <IconComp size={14} color={active ? '#818cf8' : undefined} />
                  <span>{m.label}</span>
                </button>
              )
            })}
          </div>

          {/* Quick Clickable Suggestions */}
          {!hasValidQuery && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.45rem',
              flexWrap: 'wrap',
              marginTop: '1.25rem',
            }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Examples:
              </span>
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
                    padding: '0.22rem 0.6rem',
                    fontSize: '0.75rem',
                    backgroundColor: 'var(--bg-surface-0)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-pill)',
                  }}
                >
                  <span>{item.text}</span>
                </button>
              ))}
            </div>
          )}
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
          marginBottom: '1.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          boxShadow: 'var(--shadow-md)',
        }}>
          {exportMessage.type === 'success' ? <CheckCircle size={18} weight="bold" /> : <WarningCircle size={18} weight="bold" />}
          <span>{exportMessage.text}</span>
        </div>
      )}

      {/* Synchronized Moment Player Workspace (Desktop Video Inspector) */}
      {selectedResult && (
        <div style={{
          backgroundColor: 'var(--bg-surface-0)',
          border: '1px solid var(--border-active)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem',
          marginBottom: '2.5rem',
          boxShadow: 'var(--shadow-lg)',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.85rem',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
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
                  Moment: {formatTime(selectedResult.start_time)} – {formatTime(selectedResult.end_time)}
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
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
                }}
                title="Inspect full video analysis and transcripts"
              >
                <ArrowSquareOut size={15} />
              </button>
            </div>
          </div>

          {proxyUrl ? (
            <video
              ref={videoRef}
              src={proxyUrl}
              controls
              autoPlay
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={handleVideoTimeUpdate}
              style={{
                width: '100%',
                maxHeight: '440px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#000',
              }}
            />
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
          marginBottom: '1.5rem',
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

      {/* Ranked Moments Result List */}
      {searchData && searchData.results.length > 0 && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {searchData.results.map((result, idx) => {
            const thumbUrl = getAssetUrl(result.thumbnail_path)
            const isSelected = selectedResult === result
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
                        {formatTime(result.start_time)} – {formatTime(result.end_time)}
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
