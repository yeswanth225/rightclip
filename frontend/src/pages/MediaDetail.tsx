import { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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

  const { data: transcript, isLoading: transcriptLoading } = useQuery({
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

  const { data: scenesData, isLoading: scenesLoading } = useQuery({
    queryKey: ['scenes', id],
    queryFn: () => mediaService.getScenes(Number(id)),
    enabled: !!media && media.status === 'ready',
    retry: false,
  })

  const { data: keyframesData, isLoading: keyframesLoading } = useQuery({
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
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`
  }

  const handleSeek = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds
      videoRef.current.play().catch(() => {})
    }
  }

  if (isLoading) {
    return (
      <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading video analysis...
      </div>
    )
  }

  if (error || !media) {
    return (
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{
          padding: '1rem',
          backgroundColor: 'rgba(244, 63, 94, 0.1)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          borderRadius: 'var(--radius-md)',
          color: '#fb7185',
        }}>
          Media asset not found
        </div>
      </div>
    )
  }

  const proxyUrl = getAssetUrl(media.proxy_path || media.file_path)

  const filteredSegments = (transcript?.segments || []).filter((seg) =>
    seg.text.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const tabs: { id: TabType; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'transcript', label: 'Dialogue Transcript', count: transcript?.segments?.length },
    { id: 'scenes', label: 'Scenes & Cuts', count: scenesData?.total_scenes },
    { id: 'keyframes', label: 'Visual Vectors', count: keyframesData?.total_keyframes },
  ]

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
      {/* Top breadcrumb & action bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => navigate('/library')}
            style={{
              padding: '0.4rem 0.8rem',
              fontSize: '0.8rem',
              backgroundColor: 'var(--bg-surface-0)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            ← Library
          </button>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-pure)', margin: 0 }}>
            {media.filename}
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => navigate('/search')}
            style={{
              padding: '0.45rem 0.95rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              backgroundColor: 'var(--accent-primary)',
              color: '#fff',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            🔍 Search Moments
          </button>
          <button
            onClick={() => navigate(`/media/${media.id}/edit-clip`)}
            style={{
              padding: '0.45rem 0.95rem',
              fontSize: '0.85rem',
              fontWeight: 500,
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            ✂️ Clip Editor
          </button>
        </div>
      </div>

      {/* Main Video Viewport */}
      {proxyUrl && (
        <div style={{
          backgroundColor: '#000',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          marginBottom: '1.5rem',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
        }}>
          <video
            ref={videoRef}
            src={proxyUrl}
            controls
            style={{ width: '100%', maxHeight: '460px', display: 'block' }}
          />
        </div>
      )}

      {/* Analysis Hierarchy Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: '1.5rem',
      }}>
        {tabs.map((tab) => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '0.65rem 1rem',
                fontSize: '0.875rem',
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--text-pure)' : 'var(--text-secondary)',
                background: 'transparent',
                borderBottom: active ? '2px solid var(--accent-primary)' : '2px solid transparent',
                borderRadius: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span style={{
                  fontSize: '0.75rem',
                  fontFamily: 'JetBrains Mono, monospace',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  backgroundColor: active ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                  color: active ? '#a5b4fc' : 'var(--text-muted)',
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab Panels */}
      {activeTab === 'overview' && (
        <div style={{
          backgroundColor: 'var(--bg-surface-0)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.5rem',
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Source Type</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-pure)', marginTop: '2px' }}>{media.source_type}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Duration</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-pure)', marginTop: '2px', fontFamily: 'JetBrains Mono, monospace' }}>
              {formatTime(media.duration || 0)} ({media.duration?.toFixed(2)}s)
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Dimensions & FPS</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-pure)', marginTop: '2px', fontFamily: 'JetBrains Mono, monospace' }}>
              {media.width}×{media.height} @ {media.fps?.toFixed(1)} fps
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Codecs</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-pure)', marginTop: '2px' }}>
              Video: {media.video_codec || '—'} / Audio: {media.audio_codec || '—'}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'transcript' && (
        <div style={{
          backgroundColor: 'var(--bg-surface-0)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.5rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Search transcript text..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: 1,
                maxWidth: '400px',
                padding: '0.45rem 0.75rem',
                backgroundColor: 'var(--bg-surface-1)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-pure)',
                fontSize: '0.85rem',
              }}
            />
            {(!transcript || transcript.status === 'failed') && (
              <button
                onClick={() => transcribeMutation.mutate()}
                disabled={transcribeMutation.isPending}
                style={{
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--accent-primary)',
                  color: '#fff',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {transcribeMutation.isPending ? 'Transcribing...' : 'Run Transcription'}
              </button>
            )}
          </div>

          {transcriptLoading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading speech transcript...</p>
          ) : !transcript || filteredSegments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No speech segments found.</p>
          ) : (
            <div style={{ display: 'grid', gap: '0.5rem', maxHeight: '420px', overflowY: 'auto' }}>
              {filteredSegments.map((seg) => (
                <div
                  key={seg.id}
                  onClick={() => handleSeek(seg.start_time)}
                  style={{
                    padding: '0.65rem 0.85rem',
                    backgroundColor: 'var(--bg-surface-1)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)', marginBottom: '0.2rem' }}>
                    <span>▶ {formatTime(seg.start_time)} – {formatTime(seg.end_time)}</span>
                  </div>
                  <div style={{ color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                    {seg.text}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'scenes' && (
        <div style={{
          backgroundColor: 'var(--bg-surface-0)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.5rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Detected scene transitions across video timeline. Click any card to seek.
            </span>
            <button
              onClick={() => detectScenesMutation.mutate()}
              disabled={detectScenesMutation.isPending}
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: '0.8rem',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {detectScenesMutation.isPending ? 'Detecting...' : 'Re-detect Scenes'}
            </button>
          </div>

          {scenesLoading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading detected scenes...</p>
          ) : !scenesData || scenesData.scenes.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No scenes detected.</p>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '1rem',
            }}>
              {scenesData.scenes.map((scene) => {
                const thumbUrl = getAssetUrl(scene.thumbnail_path)
                return (
                  <div
                    key={scene.id}
                    onClick={() => handleSeek(scene.start_time)}
                    style={{
                      backgroundColor: 'var(--bg-surface-1)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      cursor: 'pointer',
                    }}
                  >
                    {thumbUrl && (
                      <img
                        src={thumbUrl}
                        alt={`Scene ${scene.scene_index + 1}`}
                        style={{ width: '100%', height: '110px', objectFit: 'cover', display: 'block' }}
                      />
                    )}
                    <div style={{ padding: '0.5rem 0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-pure)' }}>
                        <span>Scene #{scene.scene_index + 1}</span>
                        <span style={{ color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono, monospace' }}>{scene.duration.toFixed(1)}s</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', marginTop: '2px' }}>
                        {formatTime(scene.start_time)} → {formatTime(scene.end_time)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'keyframes' && (
        <div style={{
          backgroundColor: 'var(--bg-surface-0)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.5rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              OpenCLIP ViT-B/32 indexed keyframes stored in ChromaDB vector space.
            </span>
            <button
              onClick={() => indexVisualMutation.mutate()}
              disabled={indexVisualMutation.isPending}
              style={{
                padding: '0.4rem 0.8rem',
                fontSize: '0.8rem',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                color: '#a5b4fc',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {indexVisualMutation.isPending ? 'Indexing...' : 'Re-index Visuals'}
            </button>
          </div>

          {keyframesLoading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading indexed keyframes...</p>
          ) : !keyframesData || keyframesData.keyframes.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No keyframes indexed.</p>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
              gap: '0.85rem',
            }}>
              {keyframesData.keyframes.map((kf) => {
                const kfUrl = getAssetUrl(kf.file_path)
                return (
                  <div
                    key={kf.id}
                    onClick={() => handleSeek(kf.timestamp)}
                    style={{
                      backgroundColor: 'var(--bg-surface-1)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      cursor: 'pointer',
                    }}
                  >
                    {kfUrl && (
                      <img
                        src={kfUrl}
                        alt={`Keyframe at ${kf.timestamp}s`}
                        style={{ width: '100%', height: '96px', objectFit: 'cover', display: 'block' }}
                      />
                    )}
                    <div style={{ padding: '0.45rem 0.65rem' }}>
                      <span style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent-cyan)', fontWeight: 500 }}>
                        ▶ {formatTime(kf.timestamp)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
