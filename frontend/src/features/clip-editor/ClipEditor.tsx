import { useState, useRef, useEffect, useCallback } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  const { data: media, isLoading: mediaLoading, error: mediaError } = useQuery({
    queryKey: ['media', id],
    queryFn: () => mediaService.getMedia(Number(id)),
    enabled: !!id,
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
      : 'My Highlight Clip'
  )
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('')
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'playhead' | null>(null)

  // Sync initial boundaries once media is loaded if not explicitly set
  useEffect(() => {
    if (media?.duration) {
      if (endTime > media.duration) {
        setEndTime(media.duration)
      }
    }
  }, [media?.duration])

  // Time format helper
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
      setSaveSuccessMsg('✓ Clip selection saved successfully!')
      setTimeout(() => setSaveSuccessMsg(''), 4000)
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

  // Keyboard Shortcuts (I=In/Start, O=Out/End, Space=Play, Left/Right=Frame step)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid intercepting input tags
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
  }, [togglePlay, startTime, endTime, duration])

  // Dragging timeline handles
  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>, handle: 'start' | 'end' | 'playhead') => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(handle)
  }

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || isDragging) return
    const rect = timelineRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percent = Math.max(0, Math.min(1, clickX / rect.width))
    const targetTime = percent * duration

    if (videoRef.current) {
      videoRef.current.currentTime = targetTime
      setCurrentTime(targetTime)
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !timelineRef.current) return
      const rect = timelineRef.current.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const percent = Math.max(0, Math.min(1, clickX / rect.width))
      const timeAtPos = percent * duration

      if (isDragging === 'start') {
        handleSetStart(timeAtPos)
      } else if (isDragging === 'end') {
        handleSetEnd(timeAtPos)
      } else if (isDragging === 'playhead') {
        if (videoRef.current) {
          videoRef.current.currentTime = timeAtPos
          setCurrentTime(timeAtPos)
        }
      }
    }

    const handleMouseUp = () => {
      if (isDragging) setIsDragging(null)
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, duration, startTime, endTime])

  if (mediaLoading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)' }}>
        Loading clip editor & media assets...
      </div>
    )
  }

  if (mediaError || !media) {
    return (
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{
          padding: '1.5rem',
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          borderRadius: '8px',
          color: '#ff6b6b',
        }}>
          <h3>Media Asset Not Found</h3>
          <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
            The requested video could not be loaded into the Clip Editor.
          </p>
          <button
            onClick={() => navigate('/library')}
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
            }}
          >
            ← Return to Media Library
          </button>
        </div>
      </div>
    )
  }

  const proxyUrl = getAssetUrl(media.proxy_path || media.file_path)
  const isAdjusted = Math.abs(startTime - aiStart) > 0.05 || Math.abs(endTime - aiEnd) > 0.05
  const selectedDuration = Math.max(0, endTime - startTime)

  // Timeline percentage coordinates
  const startPercent = duration > 0 ? (startTime / duration) * 100 : 0
  const endPercent = duration > 0 ? (endTime / duration) * 100 : 100
  const playheadPercent = duration > 0 ? (currentTime / duration) * 100 : 0
  const aiStartPercent = duration > 0 ? (aiStart / duration) * 100 : 0
  const aiEndPercent = duration > 0 ? (aiEnd / duration) * 100 : 100

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.8rem',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: 'rgba(255, 255, 255, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
              }}
            >
              ← Back
            </button>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#fff' }}>
              Clip Editor
            </h1>
            <span style={{ fontSize: '0.75rem', padding: '2px 8px', backgroundColor: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc', borderRadius: '12px', fontWeight: 600 }}>
              Phase 7 Precision Trimmer
            </span>
          </div>
          <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem', margin: 0 }}>
            Source: <strong style={{ color: '#fff' }}>{media.filename}</strong> ({formatTime(duration)} total, {fps.toFixed(1)} FPS)
          </p>
        </div>

        {/* AI Origin Badge / Info */}
        {navState.searchResult && (
          <div style={{
            padding: '0.5rem 0.85rem',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            borderRadius: '8px',
            fontSize: '0.8rem',
          }}>
            <div style={{ color: '#818cf8', fontWeight: 600 }}>
              AI Suggested Discovery:
            </div>
            <div style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.75rem', marginTop: '2px' }}>
              {navState.searchResult.evidence?.explanation || `Match at ${formatTime(navState.searchResult.start_time)}`}
            </div>
          </div>
        )}
      </div>

      {/* Main Video Viewport */}
      <div style={{
        backgroundColor: '#000',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        position: 'relative',
        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6)',
      }}>
        {proxyUrl ? (
          <video
            ref={videoRef}
            src={proxyUrl}
            onTimeUpdate={handleTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            style={{ width: '100%', maxHeight: '460px', display: 'block' }}
          />
        ) : (
          <div style={{ padding: '5rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.4)' }}>
            Video proxy stream unavailable.
          </div>
        )}

        {/* Overlay Current Playback info */}
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          padding: '4px 10px',
          borderRadius: '6px',
          fontSize: '0.8rem',
          fontFamily: 'JetBrains Mono, monospace',
          color: '#38bdf8',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          PLAYHEAD: {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Editor Timeline & Precision Controls Card */}
      <div style={{
        marginTop: '1.25rem',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '1.5rem',
      }}>
        {/* Visual Timeline Bar */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.5rem' }}>
            <span>00:00.000</span>
            <span style={{ color: isAdjusted ? '#fbbf24' : '#818cf8', fontWeight: 600 }}>
              {isAdjusted ? 'User-Adjusted Selection' : 'AI-Suggested Selection'} ({formatTime(selectedDuration)} duration)
            </span>
            <span>{formatTime(duration)}</span>
          </div>

          <div
            ref={timelineRef}
            onClick={handleTimelineClick}
            style={{
              position: 'relative',
              height: '42px',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              cursor: 'pointer',
              userSelect: 'none',
              overflow: 'hidden',
            }}
          >
            {/* AI Suggestion Ghost Range */}
            <div
              title={`Original AI Suggestion: ${formatTime(aiStart)} - ${formatTime(aiEnd)}`}
              style={{
                position: 'absolute',
                left: `${aiStartPercent}%`,
                width: `${aiEndPercent - aiStartPercent}%`,
                top: 0,
                bottom: 0,
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                borderLeft: '1px dashed rgba(99, 102, 241, 0.6)',
                borderRight: '1px dashed rgba(99, 102, 241, 0.6)',
                pointerEvents: 'none',
              }}
            />

            {/* Selected Clip Highlight Range */}
            <div
              style={{
                position: 'absolute',
                left: `${startPercent}%`,
                width: `${endPercent - startPercent}%`,
                top: 0,
                bottom: 0,
                backgroundColor: 'rgba(99, 102, 241, 0.35)',
                borderTop: '2px solid #818cf8',
                borderBottom: '2px solid #818cf8',
              }}
            />

            {/* Start Handle */}
            <div
              onMouseDown={(e) => handleTimelineMouseDown(e, 'start')}
              title={`START Marker: ${formatTime(startTime)}`}
              style={{
                position: 'absolute',
                left: `${startPercent}%`,
                top: 0,
                bottom: 0,
                width: '12px',
                transform: 'translateX(-50%)',
                backgroundColor: '#6366f1',
                borderRadius: '4px 0 0 4px',
                cursor: 'ew-resize',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 6px rgba(0,0,0,0.8)',
              }}
            >
              <div style={{ width: '2px', height: '14px', backgroundColor: '#fff' }} />
            </div>

            {/* End Handle */}
            <div
              onMouseDown={(e) => handleTimelineMouseDown(e, 'end')}
              title={`END Marker: ${formatTime(endTime)}`}
              style={{
                position: 'absolute',
                left: `${endPercent}%`,
                top: 0,
                bottom: 0,
                width: '12px',
                transform: 'translateX(-50%)',
                backgroundColor: '#6366f1',
                borderRadius: '0 4px 4px 0',
                cursor: 'ew-resize',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 6px rgba(0,0,0,0.8)',
              }}
            >
              <div style={{ width: '2px', height: '14px', backgroundColor: '#fff' }} />
            </div>

            {/* Current Playhead Scrubber */}
            <div
              onMouseDown={(e) => handleTimelineMouseDown(e, 'playhead')}
              title={`Playhead: ${formatTime(currentTime)}`}
              style={{
                position: 'absolute',
                left: `${playheadPercent}%`,
                top: 0,
                bottom: 0,
                width: '3px',
                backgroundColor: '#38bdf8',
                transform: 'translateX(-50%)',
                cursor: 'ew-resize',
                zIndex: 20,
                boxShadow: '0 0 8px #38bdf8',
              }}
            >
              <div style={{
                position: 'absolute',
                top: 0,
                left: '-4px',
                width: '11px',
                height: '8px',
                backgroundColor: '#38bdf8',
                borderRadius: '2px',
              }} />
            </div>
          </div>
        </div>

        {/* Primary Controls Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1.5rem', alignItems: 'center', marginBottom: '1.5rem' }}>
          {/* Start Boundary Controls */}
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#818cf8', textTransform: 'uppercase' }}>
                Start Boundary
              </span>
              <button
                onClick={() => handleSetStart(currentTime)}
                style={{
                  padding: '2px 8px',
                  fontSize: '0.75rem',
                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  color: '#a5b4fc',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  borderRadius: '4px',
                }}
              >
                Set to Playhead (I)
              </button>
            </div>
            <div style={{ fontSize: '1.25rem', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>
              {formatTime(startTime)}
            </div>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button onClick={() => handleSetStart(startTime - 1.0)} style={stepBtnStyle}>-1s</button>
              <button onClick={() => handleSetStart(startTime - 0.1)} style={stepBtnStyle}>-0.1s</button>
              <button onClick={() => handleSetStart(startTime + 0.1)} style={stepBtnStyle}>+0.1s</button>
              <button onClick={() => handleSetStart(startTime + 1.0)} style={stepBtnStyle}>+1s</button>
            </div>
          </div>

          {/* Center Playback & Frame Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                onClick={() => handleStepFrame(-1)}
                title="Step Back 1 Frame (Left Arrow)"
                style={actionBtnStyle}
              >
                ◀ Frame
              </button>

              <button
                onClick={togglePlay}
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  backgroundColor: isPlaying ? '#ef4444' : '#6366f1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
                }}
              >
                {isPlaying ? '⏸ Pause' : '▶ Play'}
              </button>

              <button
                onClick={() => handleStepFrame(1)}
                title="Step Forward 1 Frame (Right Arrow)"
                style={actionBtnStyle}
              >
                Frame ▶
              </button>
            </div>

            {/* Preview Selection Button */}
            <button
              onClick={handlePreviewSelection}
              style={{
                padding: '0.45rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                backgroundColor: isPreviewingSelection ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                color: isPreviewingSelection ? '#34d399' : '#fff',
                border: isPreviewingSelection ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
              }}
            >
              🔁 Preview Selected Clip ({formatTime(selectedDuration)})
            </button>
          </div>

          {/* End Boundary Controls */}
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#818cf8', textTransform: 'uppercase' }}>
                End Boundary
              </span>
              <button
                onClick={() => handleSetEnd(currentTime)}
                style={{
                  padding: '2px 8px',
                  fontSize: '0.75rem',
                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  color: '#a5b4fc',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  borderRadius: '4px',
                }}
              >
                Set to Playhead (O)
              </button>
            </div>
            <div style={{ fontSize: '1.25rem', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>
              {formatTime(endTime)}
            </div>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button onClick={() => handleSetEnd(endTime - 1.0)} style={stepBtnStyle}>-1s</button>
              <button onClick={() => handleSetEnd(endTime - 0.1)} style={stepBtnStyle}>-0.1s</button>
              <button onClick={() => handleSetEnd(endTime + 0.1)} style={stepBtnStyle}>+0.1s</button>
              <button onClick={() => handleSetEnd(endTime + 1.0)} style={stepBtnStyle}>+1s</button>
            </div>
          </div>
        </div>

        {/* Action Bar: Title, Save, Reset */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '1.25rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '280px' }}>
            <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>Clip Title:</span>
            <input
              type="text"
              value={clipTitle}
              onChange={(e) => setClipTitle(e.target.value)}
              placeholder="Clip title..."
              style={{
                flex: 1,
                padding: '0.45rem 0.75rem',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={handleResetToAI}
              style={{
                padding: '0.55rem 1rem',
                fontSize: '0.85rem',
                backgroundColor: 'transparent',
                color: 'rgba(255, 255, 255, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
              }}
            >
              ↺ Reset to AI Suggestion
            </button>

            <button
              onClick={() => saveClipMutation.mutate()}
              disabled={saveClipMutation.isPending}
              style={{
                padding: '0.55rem 1.25rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                backgroundColor: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: saveClipMutation.isPending ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
              }}
            >
              {saveClipMutation.isPending ? 'Saving...' : '💾 Save Clip Selection'}
            </button>
          </div>
        </div>

        {saveSuccessMsg && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '6px',
            color: '#34d399',
            fontSize: '0.875rem',
            textAlign: 'center',
          }}>
            {saveSuccessMsg}
          </div>
        )}
      </div>

      {/* Saved Clips Section */}
      {savedClipsData && savedClipsData.clips.length > 0 && (
        <div style={{
          marginTop: '2rem',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '1.5rem',
        }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1rem', color: '#fff' }}>
            Saved Clip Selections ({savedClipsData.total_clips})
          </h2>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {savedClipsData.clips.map((c: Clip) => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '8px',
                }}
              >
                <div>
                  <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{c.title}</strong>
                  <div style={{ fontSize: '0.75rem', color: '#818cf8', marginTop: '2px' }}>
                    Range: {formatTime(c.start_time)} – {formatTime(c.end_time)} ({c.duration.toFixed(2)}s)
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => {
                      setStartTime(c.start_time)
                      setEndTime(c.end_time)
                      if (videoRef.current) {
                        videoRef.current.currentTime = c.start_time
                      }
                    }}
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.75rem',
                      backgroundColor: 'rgba(99, 102, 241, 0.2)',
                      color: '#a5b4fc',
                      border: '1px solid rgba(99, 102, 241, 0.4)',
                      borderRadius: '4px',
                    }}
                  >
                    Load in Timeline
                  </button>
                  <button
                    onClick={async () => {
                      await mediaService.deleteClip(c.id)
                      queryClient.invalidateQueries({ queryKey: ['media-clips', id] })
                    }}
                    style={{
                      padding: '0.35rem 0.6rem',
                      fontSize: '0.75rem',
                      backgroundColor: 'rgba(220, 38, 38, 0.1)',
                      color: '#ff6b6b',
                      border: '1px solid rgba(220, 38, 38, 0.2)',
                      borderRadius: '4px',
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Documentation Footer */}
      <div style={{
        marginTop: '1.5rem',
        padding: '1rem',
        backgroundColor: 'rgba(255, 255, 255, 0.01)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '8px',
        fontSize: '0.75rem',
        color: 'rgba(255, 255, 255, 0.5)',
        display: 'flex',
        justifyContent: 'space-around',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}>
        <span>⌨️ <strong>Space:</strong> Play / Pause</span>
        <span>⌨️ <strong>I:</strong> Mark Start Boundary</span>
        <span>⌨️ <strong>O:</strong> Mark End Boundary</span>
        <span>⌨️ <strong>← / →:</strong> Step 1 Frame</span>
        <span>⌨️ <strong>Shift + ← / →:</strong> Step 5 Frames</span>
      </div>
    </div>
  )
}

const stepBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.3rem 0',
  fontSize: '0.75rem',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  color: 'rgba(255, 255, 255, 0.8)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '4px',
}

const actionBtnStyle: React.CSSProperties = {
  padding: '0.5rem 0.85rem',
  fontSize: '0.8rem',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  color: 'rgba(255, 255, 255, 0.8)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: '6px',
}
