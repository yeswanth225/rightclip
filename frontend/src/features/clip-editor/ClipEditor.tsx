import { useState, useRef, useEffect, useCallback } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Scissors,
  Play,
  Pause,
  ArrowCounterClockwise,
  DownloadSimple,
  Trash,
  CheckCircle,
  WarningCircle,
  ArrowLeft,
} from '@phosphor-icons/react'
import { mediaService } from '../../services/mediaService'
import { getAssetUrl } from '../../utils/assets'
import type { UnifiedSearchResult, Clip } from '../../types/media'

export default function ClipEditor() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Navigation state passed from Search Result (if available)
  const navState = (location.state as {
    searchResult?: UnifiedSearchResult
    initialStart?: number
    initialEnd?: number
    searchQuery?: string
  }) || {}

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const timelineRef = useRef<HTMLDivElement | null>(null)

  // Fetch Media Asset
  const { data: media } = useQuery({
    queryKey: ['media', id],
    queryFn: () => mediaService.getMedia(Number(id)),
    enabled: !!id,

    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.status && ['uploaded', 'downloading', 'validating', 'processing'].includes(data.status)) {
        return 2000
      }
      return false
    },
  })

  // Fetch existing saved clips for this media
  const { data: savedClipsData } = useQuery({
    queryKey: ['media-clips', id],
    queryFn: () => mediaService.getMediaClips(Number(id)),
    enabled: !!id,
  })

  // Boundaries & State
  const duration = media?.duration || 10.0
  const fps = media?.fps || 30.0
  const frameDuration = 1.0 / fps

  // AI Suggested boundaries
  const aiStart = navState.initialStart ?? (navState.searchResult ? navState.searchResult.start_time : 0.0)
  const aiEnd = navState.initialEnd ?? (navState.searchResult ? navState.searchResult.end_time : Math.min(5.0, duration))

  const [startTime, setStartTime] = useState<number>(aiStart)
  const [endTime, setEndTime] = useState<number>(aiEnd)
  const [currentTime, setCurrentTime] = useState<number>(aiStart)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [isPreviewingSelection, setIsPreviewingSelection] = useState<boolean>(false)
  const [clipTitle, setClipTitle] = useState<string>(
    navState.searchResult?.media_filename
      ? `Clip: ${navState.searchResult.media_filename.replace(/\.[^/.]+$/, '')} (${formatTime(aiStart)}-${formatTime(aiEnd)})`
      : 'Highlight Clip'
  )
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Sync initial boundaries once media is loaded if not explicitly set
  useEffect(() => {
    if (media?.duration) {
      if (endTime > media.duration) {
        setEndTime(media.duration)
      }
    }
  }, [media?.duration])

  function formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '00:00.000'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
  }

  // Mutation to save clip
  const saveClipMutation = useMutation({
    mutationFn: () => {
      return mediaService.createClip({
        media_id: Number(id),
        title: clipTitle.trim() || 'Untitled Clip',
        start_time: Math.round(startTime * 1000) / 1000,
        end_time: Math.round(endTime * 1000) / 1000,
        search_query: navState.searchQuery || navState.searchResult?.evidence?.explanation,
        evidence_json: navState.searchResult?.evidence as any,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-clips', id] })
      setStatusMsg({ text: '✓ Clip saved to project library!', type: 'success' })
      setTimeout(() => setStatusMsg(null), 4000)
    },
    onError: (err: any) => {
      setStatusMsg({ text: `Save failed: ${err?.response?.data?.detail || err.message}`, type: 'error' })
      setTimeout(() => setStatusMsg(null), 5000)
    },
  })

  // Mutation to export physical MP4
  const exportMutation = useMutation({
    mutationFn: () =>
      mediaService.exportMoment(
        Number(id),
        Math.round(startTime * 1000) / 1000,
        Math.round(endTime * 1000) / 1000,
        clipTitle.trim() || 'Trimmed Clip'
      ),
    onSuccess: (data) => {
      setStatusMsg({ text: `✓ MP4 clip exported! Downloading...`, type: 'success' })
      const a = document.createElement('a')
      a.href = data.download_url
      a.download = `clip_${data.media_id}_${data.start_time}s_${data.end_time}s.mp4`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => setStatusMsg(null), 5000)
    },
    onError: (err: any) => {
      setStatusMsg({ text: `Export failed: ${err?.response?.data?.detail || err.message}`, type: 'error' })
      setTimeout(() => setStatusMsg(null), 5000)
    },
  })

  const deleteClipMutation = useMutation({
    mutationFn: (clipId: number) => mediaService.deleteClip(clipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-clips', id] })
    },
  })

  // Playhead update handler
  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    const cur = videoRef.current.currentTime
    setCurrentTime(cur)

    if (isPreviewingSelection) {
      if (cur >= endTime) {
        videoRef.current.pause()
        videoRef.current.currentTime = startTime
        setIsPlaying(false)
        setIsPreviewingSelection(false)
      }
    }
  }

  // Play / Pause Toggle
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {})
      setIsPlaying(true)
    } else {
      videoRef.current.pause()
      setIsPlaying(false)
      setIsPreviewingSelection(false)
    }
  }, [])

  // Preview Selected Clip region only
  const handlePreviewSelection = () => {
    if (!videoRef.current) return
    videoRef.current.currentTime = startTime
    setIsPreviewingSelection(true)
    videoRef.current.play().catch(() => {})
    setIsPlaying(true)
  }

  // Boundary Adjustments with strict validation
  const handleSetStart = (val: number) => {
    const clamped = Math.max(0, Math.min(val, endTime - 0.1))
    setStartTime(Math.round(clamped * 1000) / 1000)
  }

  const handleSetEnd = (val: number) => {
    const maxDur = media?.duration || 7200
    const clamped = Math.min(maxDur, Math.max(val, startTime + 0.1))
    setEndTime(Math.round(clamped * 1000) / 1000)
  }

  // Frame Stepping
  const handleStepFrame = (frames: number) => {
    if (!videoRef.current) return
    videoRef.current.pause()
    setIsPlaying(false)
    setIsPreviewingSelection(false)
    const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + frames * frameDuration))
    videoRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  // Reset to AI suggestion
  const handleResetToAI = () => {
    setStartTime(aiStart)
    setEndTime(Math.min(aiEnd, duration))
    if (videoRef.current) {
      videoRef.current.currentTime = aiStart
    }
  }

  // Keyboard Shortcuts (I=In, O=Out, Space=Play/Pause, Left/Right=Frame step)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return
      }

      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      } else if (e.code === 'KeyI' || e.key === 'i' || e.key === 'I') {
        e.preventDefault()
        if (videoRef.current) handleSetStart(videoRef.current.currentTime)
      } else if (e.code === 'KeyO' || e.key === 'o' || e.key === 'O') {
        e.preventDefault()
        if (videoRef.current) handleSetEnd(videoRef.current.currentTime)
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        handleStepFrame(e.shiftKey ? -5 : -1)
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        handleStepFrame(e.shiftKey ? 5 : 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay, startTime, endTime, duration, frameDuration])

  const proxyUrl = getAssetUrl(media?.proxy_path || media?.file_path)
  const clipDuration = Math.max(0, endTime - startTime)

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1.5rem 5rem' }}>
      {/* Top Header & Breadcrumbs */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => navigate(navState.searchQuery ? '/search' : `/media/${id}`)}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.8rem',
              backgroundColor: 'var(--bg-surface-0)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-pure)', margin: 0 }}>
              Clip Boundary Editor
            </h1>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {media?.filename || 'Loading asset...'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
            style={{
              padding: '0.5rem 1.1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              backgroundColor: 'var(--accent-primary)',
              color: '#fff',
              borderRadius: 'var(--radius-sm)',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            <DownloadSimple size={16} weight="bold" />
            <span>{exportMutation.isPending ? 'Exporting MP4...' : 'Export MP4'}</span>
          </button>

          <button
            onClick={() => saveClipMutation.mutate()}
            disabled={saveClipMutation.isPending}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 500,
              backgroundColor: 'var(--bg-surface-0)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <Scissors size={16} />
            <span>Save Selection</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {statusMsg && (
        <div style={{
          padding: '0.75rem 1.25rem',
          backgroundColor: statusMsg.type === 'success' ? 'var(--accent-emerald-subtle)' : 'var(--accent-rose-subtle)',
          border: `1px solid ${statusMsg.type === 'success' ? 'var(--accent-emerald-border)' : 'var(--accent-rose-border)'}`,
          borderRadius: 'var(--radius-md)',
          color: statusMsg.type === 'success' ? '#34d399' : '#fb7185',
          fontSize: '0.85rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          {statusMsg.type === 'success' ? <CheckCircle size={18} weight="bold" /> : <WarningCircle size={18} weight="bold" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left Column: Player & Precision Timeline */}
        <div>
          {/* Video Player */}
          <div style={{
            backgroundColor: '#000',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-lg)',
            marginBottom: '1.25rem',
          }}>
            {proxyUrl ? (
              <video
                ref={videoRef}
                src={proxyUrl}
                onTimeUpdate={handleTimeUpdate}
                style={{ width: '100%', maxHeight: '480px', display: 'block' }}
              />
            ) : (
              <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                Loading video proxy...
              </div>
            )}
          </div>

          {/* Timeline & Boundary Controls Bar */}
          <div style={{
            backgroundColor: 'var(--bg-surface-0)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
          }}>
            {/* Range Scrubber Track */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontFamily: 'JetBrains Mono, monospace' }}>
                <span>00:00.000</span>
                <span style={{ color: '#818cf8', fontWeight: 600 }}>Current: {formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>

              {/* Visual Multi-Handle Range Bar */}
              <div
                ref={timelineRef}
                onClick={(e) => {
                  if (!timelineRef.current || !duration) return
                  const rect = timelineRef.current.getBoundingClientRect()
                  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
                  const targetTime = pct * duration
                  if (videoRef.current) {
                    videoRef.current.currentTime = targetTime
                  }
                }}
                style={{
                  position: 'relative',
                  height: '28px',
                  backgroundColor: 'var(--bg-surface-2)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  overflow: 'hidden',
                }}
              >
                {/* Active Clip Region Highlight */}
                {duration > 0 && (
                  <div style={{
                    position: 'absolute',
                    left: `${(startTime / duration) * 100}%`,
                    width: `${((endTime - startTime) / duration) * 100}%`,
                    top: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(99, 102, 241, 0.35)',
                    borderLeft: '2px solid #818cf8',
                    borderRight: '2px solid #818cf8',
                  }} />
                )}

                {/* Playhead Marker */}
                {duration > 0 && (
                  <div style={{
                    position: 'absolute',
                    left: `${(currentTime / duration) * 100}%`,
                    top: 0,
                    bottom: 0,
                    width: '2px',
                    backgroundColor: '#fff',
                    boxShadow: '0 0 8px rgba(255, 255, 255, 0.8)',
                    zIndex: 2,
                  }} />
                )}
              </div>
            </div>

            {/* Transport & Boundary Sliders */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
            }}>
              {/* Playback & Stepping Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  onClick={togglePlay}
                  style={{
                    padding: '0.5rem 0.95rem',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#fff',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                  title="Play/Pause [Space]"
                >
                  {isPlaying ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>

                <button
                  onClick={handlePreviewSelection}
                  style={{
                    padding: '0.5rem 0.85rem',
                    backgroundColor: 'var(--accent-primary-subtle)',
                    color: '#a5b4fc',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.82rem',
                    fontWeight: 500,
                  }}
                  title="Loop / Preview selected boundaries only"
                >
                  <Play size={14} />
                  <span>Preview Clip ({clipDuration.toFixed(1)}s)</span>
                </button>

                <button
                  onClick={() => handleStepFrame(-1)}
                  style={{
                    padding: '0.5rem 0.65rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                  title="Step -1 frame [Left Arrow]"
                >
                  -1f
                </button>

                <button
                  onClick={() => handleStepFrame(1)}
                  style={{
                    padding: '0.5rem 0.65rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-secondary)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                  title="Step +1 frame [Right Arrow]"
                >
                  +1f
                </button>
              </div>

              {/* Set IN / OUT buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  onClick={() => handleSetStart(currentTime)}
                  style={{
                    padding: '0.45rem 0.75rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    color: 'var(--text-pure)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                  }}
                  title="Set Start Point [I]"
                >
                  [ Set IN (I)
                </button>

                <button
                  onClick={() => handleSetEnd(currentTime)}
                  style={{
                    padding: '0.45rem 0.75rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    color: 'var(--text-pure)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                  }}
                  title="Set End Point [O]"
                >
                  ] Set OUT (O)
                </button>

                {navState.searchResult && (
                  <button
                    onClick={handleResetToAI}
                    style={{
                      padding: '0.45rem 0.75rem',
                      backgroundColor: 'transparent',
                      color: 'var(--text-secondary)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.78rem',
                    }}
                    title="Reset to AI search moment boundaries"
                  >
                    <ArrowCounterClockwise size={14} />
                    <span>Reset AI</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Clip Meta & Saved Selections */}
        <div>
          {/* Active Clip Card */}
          <div className="card-surface" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-pure)', marginBottom: '0.75rem' }}>
              Clip Parameters
            </h3>

            <div style={{ marginBottom: '0.85rem' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.3rem' }}>
                Clip Title
              </label>
              <input
                type="text"
                value={clipTitle}
                onChange={(e) => setClipTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  fontSize: '0.85rem',
                  backgroundColor: 'var(--bg-surface-1)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-pure)',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>
                  Start (IN)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max={endTime - 0.1}
                  value={startTime}
                  onChange={(e) => handleSetStart(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.65rem',
                    fontSize: '0.85rem',
                    fontFamily: 'JetBrains Mono, monospace',
                    backgroundColor: 'var(--bg-surface-1)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-pure)',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>
                  End (OUT)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min={startTime + 0.1}
                  max={duration}
                  value={endTime}
                  onChange={(e) => handleSetEnd(parseFloat(e.target.value) || duration)}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.65rem',
                    fontSize: '0.85rem',
                    fontFamily: 'JetBrains Mono, monospace',
                    backgroundColor: 'var(--bg-surface-1)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-pure)',
                  }}
                />
              </div>
            </div>

            <div style={{
              padding: '0.75rem',
              backgroundColor: 'var(--bg-surface-1)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.8rem',
              fontFamily: 'JetBrains Mono, monospace',
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>Selected Duration</span>
              <strong style={{ color: '#22d3ee' }}>{clipDuration.toFixed(3)}s</strong>
            </div>
          </div>

          {/* Saved Clips List */}
          <div className="card-surface" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-pure)' }}>
                Saved Clips ({savedClipsData?.total_clips || 0})
              </h3>
            </div>

            {savedClipsData?.clips && savedClipsData.clips.length > 0 ? (
              <div style={{ display: 'grid', gap: '0.65rem', maxHeight: '340px', overflowY: 'auto' }}>
                {savedClipsData.clips.map((clip: Clip) => (
                  <div
                    key={clip.id}
                    style={{
                      padding: '0.65rem',
                      backgroundColor: 'var(--bg-surface-1)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-pure)', display: 'block' }}>
                        {clip.title}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: '#818cf8', fontFamily: 'JetBrains Mono, monospace' }}>
                        {formatTime(clip.start_time)} – {formatTime(clip.end_time)} ({clip.duration.toFixed(1)}s)
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <button
                        onClick={() => {
                          setStartTime(clip.start_time)
                          setEndTime(clip.end_time)
                          if (videoRef.current) {
                            videoRef.current.currentTime = clip.start_time
                          }
                        }}
                        style={{
                          background: 'transparent',
                          color: '#a5b4fc',
                          padding: '2px 5px',
                        }}
                        title="Load boundaries"
                      >
                        <Play size={14} />
                      </button>
                      <button
                        onClick={() => deleteClipMutation.mutate(clip.id)}
                        style={{
                          background: 'transparent',
                          color: 'var(--text-dim)',
                          padding: '2px 5px',
                        }}
                        title="Delete saved clip"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.78rem' }}>
                No saved clips for this media yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
