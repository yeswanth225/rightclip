import { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  MagnifyingGlass,
  Scissors,
  FilmStrip,
  ChatCircleText,
  Eye,
  ArrowClockwise,
  WarningCircle,
} from '@phosphor-icons/react'
import { mediaService } from '../services/mediaService'
import { getAssetUrl } from '../utils/assets'

type TabType = 'overview' | 'transcript' | 'scenes' | 'keyframes'

export default function MediaDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentTime, setCurrentTime] = useState(0)

  const { data: media, isLoading, error } = useQuery({
    queryKey: ['media', id],
    queryFn: () => mediaService.getMedia(Number(id)),
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.status && ['uploaded', 'downloading', 'validating', 'processing'].includes(data.status)) {
        return 2000
      }
      return false
    },
  })

  const { data: transcript } = useQuery({
    queryKey: ['transcript', id],
    queryFn: () => mediaService.getTranscript(Number(id)),
    enabled: !!media && media.status === 'ready',
    retry: false,
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.status === 'transcribing' || data?.status === 'pending') {
        return 2000
      }
      return false
    },
  })

  const { data: scenesData } = useQuery({
    queryKey: ['scenes', id],
    queryFn: () => mediaService.getScenes(Number(id)),
    enabled: !!media && media.status === 'ready',
    retry: false,
  })

  const { data: keyframesData } = useQuery({
    queryKey: ['keyframes', id],
    queryFn: () => mediaService.getKeyframes(Number(id)),
    enabled: !!media && media.status === 'ready',
    retry: false,
  })


  const indexVisualMutation = useMutation({
    mutationFn: () => mediaService.triggerVisualIndexing(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keyframes', id] })
    },
  })

  const detectScenesMutation = useMutation({
    mutationFn: () => mediaService.triggerSceneDetection(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scenes', id] })
      queryClient.invalidateQueries({ queryKey: ['keyframes', id] })
    },
  })

  const transcribeMutation = useMutation({
    mutationFn: () => mediaService.triggerTranscription(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transcript', id] })
    },
  })

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '00:00.0'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 10)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`
  }

  const handleSeek = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds
      videoRef.current.play().catch(() => {})
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  if (isLoading) {
    return (
      <div style={{ padding: '5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading video analysis...
      </div>
    )
  }

  if (error || !media) {
    return (
      <div style={{ padding: '3rem 1.5rem', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{
          padding: '1.25rem',
          backgroundColor: 'var(--accent-rose-subtle)',
          border: '1px solid var(--accent-rose-border)',
          borderRadius: 'var(--radius-md)',
          color: '#fb7185',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}>
          <WarningCircle size={24} weight="bold" />
          <span>Media asset not found or failed to load.</span>
        </div>
      </div>
    )
  }

  const proxyUrl = getAssetUrl(media.proxy_path || media.file_path)

  const filteredSegments = (transcript?.segments || []).filter((seg) =>
    seg.text.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const tabs: { id: TabType; label: string; count?: number; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: FilmStrip },
    { id: 'transcript', label: 'Dialogue Transcript', count: transcript?.segments?.length, icon: ChatCircleText },
    { id: 'scenes', label: 'Scenes & Cuts', count: scenesData?.total_scenes, icon: Scissors },
    { id: 'keyframes', label: 'Visual Vectors', count: keyframesData?.total_keyframes, icon: Eye },
  ]

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '2rem 1.5rem 5rem' }}>
      {/* Top action header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => navigate('/library')}
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
            <span>Library</span>
          </button>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-pure)', margin: 0 }}>
            {media.filename}
          </h1>
          <span className={`badge-tag badge-${media.status === 'ready' ? 'ready' : 'processing'}`}>
            {media.status}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => navigate(`/search?media_id=${media.id}`)}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              backgroundColor: 'var(--accent-primary)',
              color: '#fff',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <MagnifyingGlass size={16} weight="bold" />
            <span>Search Inside Video</span>
          </button>
          <button
            onClick={() => navigate(`/media/${media.id}/edit-clip`)}
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
            <span>Open Clip Editor</span>
          </button>
        </div>
      </div>

      {/* Main Video Viewport */}
      <div style={{
        backgroundColor: '#000',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)',
        marginBottom: '2rem',
        border: '1px solid var(--border-subtle)',
      }}>
        {proxyUrl ? (
          <video
            ref={videoRef}
            src={proxyUrl}
            controls
            onTimeUpdate={handleTimeUpdate}
            style={{ width: '100%', maxHeight: '480px', display: 'block' }}
          />
        ) : (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-dim)' }}>
            Proxy video stream is being generated...
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: '1.5rem',
        paddingBottom: '0.5rem',
        flexWrap: 'wrap',
      }}>
        {tabs.map((t) => {
          const active = activeTab === t.id
          const IconComp = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                fontWeight: active ? 600 : 500,
                color: active ? '#fff' : 'var(--text-secondary)',
                backgroundColor: active ? 'var(--accent-primary-subtle)' : 'transparent',
                border: active ? '1px solid var(--border-active)' : '1px solid transparent',
                borderRadius: 'var(--radius-sm)',
                gap: '0.4rem',
              }}
            >
              <IconComp size={16} color={active ? '#818cf8' : undefined} />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span style={{
                  fontSize: '0.7rem',
                  fontFamily: 'JetBrains Mono, monospace',
                  padding: '1px 5px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                }}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Content: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
          <div className="card-surface" style={{ padding: '1.25rem' }}>
            <h4 style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
              Duration & Resolution
            </h4>
            <p style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-pure)' }}>
              {formatTime(media.duration || 0)}
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              {media.width && media.height ? `${media.width}×${media.height} @ ${media.fps || 30} fps` : 'Standard HD'}
            </p>
          </div>

          <div className="card-surface" style={{ padding: '1.25rem' }}>
            <h4 style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
              Codecs & Compression
            </h4>
            <p style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#22d3ee' }}>
              {media.video_codec || 'H.264'} / {media.audio_codec || 'AAC'}
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Web Proxy: 720p Progressive MP4
            </p>
          </div>

          <div className="card-surface" style={{ padding: '1.25rem' }}>
            <h4 style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
              Multimodal Indexing Status
            </h4>
            <p style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: '#34d399' }}>
              Indexed
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              {scenesData?.total_scenes || 0} scenes · {keyframesData?.total_keyframes || 0} vectors
            </p>
          </div>
        </div>
      )}

      {/* Tab Content: Dialogue Transcript */}
      {activeTab === 'transcript' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <input
              type="text"
              placeholder="Filter spoken dialogue..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                backgroundColor: 'var(--bg-surface-0)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-pure)',
                minWidth: '260px',
              }}
            />

            <button
              onClick={() => transcribeMutation.mutate()}
              disabled={transcribeMutation.isPending}
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                backgroundColor: 'var(--bg-surface-0)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <ArrowClockwise size={14} className={transcribeMutation.isPending ? 'anim-pulse' : ''} />
              <span>{transcribeMutation.isPending ? 'Transcribing...' : 'Re-transcribe Speech'}</span>
            </button>
          </div>

          {filteredSegments.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              No speech dialogue segments found.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {filteredSegments.map((seg) => {
                const isActive = currentTime >= seg.start_time && currentTime <= seg.end_time
                return (
                  <div
                    key={seg.id}
                    onClick={() => handleSeek(seg.start_time)}
                    style={{
                      padding: '0.75rem 1rem',
                      backgroundColor: isActive ? 'var(--accent-cyan-subtle)' : 'var(--bg-surface-0)',
                      border: isActive ? '1px solid var(--accent-cyan-border)' : '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '1rem',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{
                      fontSize: '0.75rem',
                      fontFamily: 'JetBrains Mono, monospace',
                      color: isActive ? '#22d3ee' : 'var(--text-muted)',
                      minWidth: '85px',
                    }}>
                      {formatTime(seg.start_time)}
                    </span>
                    <span style={{
                      fontSize: '0.88rem',
                      color: isActive ? 'var(--text-pure)' : 'var(--text-primary)',
                      lineHeight: 1.5,
                    }}>
                      {seg.text}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Scenes & Cuts */}
      {activeTab === 'scenes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button
              onClick={() => detectScenesMutation.mutate()}
              disabled={detectScenesMutation.isPending}
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                backgroundColor: 'var(--bg-surface-0)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <ArrowClockwise size={14} className={detectScenesMutation.isPending ? 'anim-pulse' : ''} />
              <span>{detectScenesMutation.isPending ? 'Detecting...' : 'Re-detect Scenes'}</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
            {scenesData?.scenes.map((scene) => {
              const thumbUrl = getAssetUrl(scene.thumbnail_path)
              return (
                <div
                  key={scene.id}
                  onClick={() => handleSeek(scene.start_time)}
                  className="card-surface"
                  style={{ padding: '0.75rem', cursor: 'pointer' }}
                >
                  <div style={{
                    aspectRatio: '16/9',
                    backgroundColor: '#000',
                    borderRadius: 'var(--radius-xs)',
                    overflow: 'hidden',
                    marginBottom: '0.5rem',
                    position: 'relative',
                  }}>
                    {thumbUrl ? (
                      <img src={thumbUrl} alt={`Scene ${scene.scene_index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <FilmStrip size={24} color="var(--text-dim)" />
                    )}
                    <span style={{
                      position: 'absolute',
                      bottom: '4px',
                      right: '4px',
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      fontSize: '0.68rem',
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#fff',
                    }}>
                      {formatTime(scene.start_time)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-pure)' }}>
                      Scene #{scene.scene_index + 1}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {scene.duration.toFixed(1)}s
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tab Content: Visual Vectors */}
      {activeTab === 'keyframes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button
              onClick={() => indexVisualMutation.mutate()}
              disabled={indexVisualMutation.isPending}
              style={{
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                backgroundColor: 'var(--bg-surface-0)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <ArrowClockwise size={14} className={indexVisualMutation.isPending ? 'anim-pulse' : ''} />
              <span>{indexVisualMutation.isPending ? 'Indexing...' : 'Re-index Visuals (OpenCLIP)'}</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.85rem' }}>
            {keyframesData?.keyframes.map((kf) => {
              const kfUrl = getAssetUrl(kf.file_path)
              return (
                <div
                  key={kf.id}
                  onClick={() => handleSeek(kf.timestamp)}
                  className="card-surface"
                  style={{ padding: '0.65rem', cursor: 'pointer' }}
                >
                  <div style={{
                    aspectRatio: '16/9',
                    backgroundColor: '#000',
                    borderRadius: 'var(--radius-xs)',
                    overflow: 'hidden',
                    marginBottom: '0.45rem',
                    position: 'relative',
                  }}>
                    {kfUrl ? (
                      <img src={kfUrl} alt={`Keyframe at ${kf.timestamp}s`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Eye size={20} color="var(--text-dim)" />
                    )}
                    <span style={{
                      position: 'absolute',
                      bottom: '4px',
                      right: '4px',
                      backgroundColor: 'rgba(0, 0, 0, 0.8)',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      fontSize: '0.68rem',
                      fontFamily: 'JetBrains Mono, monospace',
                      color: '#fff',
                    }}>
                      {formatTime(kf.timestamp)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Frame #{kf.frame_index + 1}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#818cf8', fontFamily: 'JetBrains Mono, monospace' }}>
                      512-dim CLIP
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
