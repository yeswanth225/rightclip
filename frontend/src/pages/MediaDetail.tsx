import { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { mediaService } from '../services/mediaService'
import { getAssetUrl } from '../utils/assets'

export default function MediaDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const { data: media, isLoading, error } = useQuery({
    queryKey: ['media', id],
    queryFn: () => mediaService.getMedia(Number(id)),
    refetchInterval: (query) => {
      // Poll every 2 seconds if still processing
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
    refetchInterval: (query) => {
      const data = query.state.data
      if (data && data.total_scenes === 0 && media?.status === 'processing') {
        return 2000
      }
      return false
    },
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



  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
      case 'completed':
        return '#4ade80'
      case 'failed':
        return '#ff6b6b'
      case 'processing':
      case 'validating':
      case 'transcribing':
        return '#fbbf24'
      case 'skipped':
        return '#94a3b8'
      default:
        return '#94a3b8'
    }
  }

  const formatTime = (seconds: number) => {
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
      <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.5)' }}>
        Loading media details...
      </div>
    )
  }

  if (error || !media) {
    return (
      <div style={{ padding: '2rem' }}>
        <div style={{
          padding: '1rem',
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          borderRadius: '8px',
          color: '#ff6b6b',
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

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <button
          onClick={() => navigate('/library')}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            color: 'rgba(255, 255, 255, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '6px',
            cursor: 'pointer',
            marginBottom: '2rem',
          }}
        >
          ← Back to Library
        </button>

        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>
          {media.filename}
        </h1>

        {/* Status Badges & Quick Action */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{
              display: 'inline-block',
              padding: '0.4rem 0.8rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              backgroundColor: `${getStatusColor(media.status)}20`,
              color: getStatusColor(media.status),
              borderRadius: '12px',
            }}>
              Media: {media.status.toUpperCase()}
            </div>

            {transcript && (
              <div style={{
                display: 'inline-block',
                padding: '0.4rem 0.8rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                backgroundColor: `${getStatusColor(transcript.status)}20`,
                color: getStatusColor(transcript.status),
                borderRadius: '12px',
              }}>
                Transcript: {transcript.status.toUpperCase()}
                {transcript.language && ` (${transcript.language.toUpperCase()})`}
              </div>
            )}
          </div>

          {media.status === 'ready' && (
            <button
              onClick={() => navigate(`/media/${media.id}/edit-clip`)}
              style={{
                padding: '0.5rem 1.1rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                backgroundColor: '#6366f1',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(99, 102, 241, 0.4)',
              }}
            >
              ✂️ Open Clip Editor
            </button>
          )}
        </div>

        {/* Video Player */}
        {proxyUrl && (
          <div style={{
            marginBottom: '2rem',
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: '#000',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          }}>
            <video
              ref={videoRef}
              src={proxyUrl}
              controls
              style={{ width: '100%', maxHeight: '480px', display: 'block' }}
            />
          </div>
        )}

        {/* Processing indicator */}
        {['uploaded', 'downloading', 'validating', 'processing'].includes(media.status) && (
          <div style={{
            padding: '1rem',
            backgroundColor: 'rgba(251, 191, 36, 0.1)',
            border: '1px solid rgba(251, 191, 36, 0.3)',
            borderRadius: '8px',
            color: '#fbbf24',
            marginBottom: '2rem',
          }}>
            ⏳ Processing media and transcription... This page will update automatically.
          </div>
        )}

        {/* Error message */}
        {media.error_message && (
          <div style={{
            padding: '1rem',
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            borderRadius: '8px',
            color: '#ff6b6b',
            marginBottom: '2rem',
          }}>
            <strong>Error:</strong> {media.error_message}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
          {/* Metadata Card */}
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '1.5rem',
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
              Media Information
            </h2>

            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <MetadataRow label="Source Type" value={media.source_type} />
              {media.source_url && <MetadataRow label="Source URL" value={media.source_url} />}
              <MetadataRow label="File Size" value={media.file_size ? `${(media.file_size / (1024 * 1024)).toFixed(2)} MB` : '—'} />
              <MetadataRow label="Duration" value={media.duration ? `${Math.floor(media.duration / 60)}:${Math.floor(media.duration % 60).toString().padStart(2, '0')}` : '—'} />
              <MetadataRow label="Resolution" value={media.width && media.height ? `${media.width} × ${media.height}` : '—'} />
              <MetadataRow label="FPS" value={media.fps ? media.fps.toFixed(2) : '—'} />
              <MetadataRow label="Video Codec" value={media.video_codec || '—'} />
              <MetadataRow label="Audio Codec" value={media.audio_codec || '—'} />
              <MetadataRow label="Created" value={new Date(media.created_at).toLocaleString()} />
            </div>
          </div>

          {/* Transcript Panel */}
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '1.5rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                Transcript & Segments
              </h2>
              {media.status === 'ready' && (!transcript || transcript.status === 'failed') && (
                <button
                  onClick={() => transcribeMutation.mutate()}
                  disabled={transcribeMutation.isPending}
                  style={{
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.8rem',
                    backgroundColor: '#6366f1',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: transcribeMutation.isPending ? 'not-allowed' : 'pointer',
                  }}
                >
                  {transcribeMutation.isPending ? 'Starting...' : 'Transcribe'}
                </button>
              )}
            </div>

            {transcriptLoading && (
              <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.875rem' }}>Loading transcript...</p>
            )}

            {transcript?.status === 'transcribing' && (
              <div style={{ padding: '1rem', backgroundColor: 'rgba(251, 191, 36, 0.1)', borderRadius: '8px', color: '#fbbf24', fontSize: '0.875rem' }}>
                ⏳ Transcribing audio with faster-whisper...
              </div>
            )}

            {transcript?.status === 'skipped' && (
              <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.875rem' }}>
                No audio track detected for this video.
              </p>
            )}

            {transcript?.status === 'failed' && (
              <div style={{ color: '#ff6b6b', fontSize: '0.875rem' }}>
                Transcription failed: {transcript.error_message}
              </div>
            )}

            {transcript?.status === 'completed' && (
              <div>
                {/* Search in transcript */}
                <input
                  type="text"
                  placeholder="Filter transcript segments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '6px',
                    color: '#fff',
                    marginBottom: '1rem',
                    boxSizing: 'border-box',
                    fontSize: '0.875rem',
                  }}
                />

                <div style={{
                  maxHeight: '380px',
                  overflowY: 'auto',
                  display: 'grid',
                  gap: '0.5rem',
                  paddingRight: '0.25rem',
                }}>
                  {filteredSegments.length === 0 ? (
                    <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.875rem' }}>
                      {searchTerm ? 'No matching segments found.' : 'No speech segments detected.'}
                    </p>
                  ) : (
                    filteredSegments.map((seg) => (
                      <div
                        key={seg.id}
                        onClick={() => handleSeek(seg.start_time)}
                        style={{
                          padding: '0.6rem 0.8rem',
                          backgroundColor: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s',
                          fontSize: '0.875rem',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.15)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)')}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ color: '#818cf8', fontWeight: 600, fontSize: '0.75rem' }}>
                            ▶ {formatTime(seg.start_time)} – {formatTime(seg.end_time)}
                          </span>
                        </div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.4 }}>
                          {seg.text}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Scene Detection & Visual Timeline */}
        <div style={{
          marginTop: '2rem',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '1.5rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
                Visual Scenes & Timeline ({scenesData?.total_scenes || 0} scenes)
              </h2>
              <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                Click any scene card or thumbnail to jump playback directly to that scene boundary
              </p>
            </div>

            {media.status === 'ready' && (
              <button
                onClick={() => detectScenesMutation.mutate()}
                disabled={detectScenesMutation.isPending}
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.8rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  cursor: detectScenesMutation.isPending ? 'not-allowed' : 'pointer',
                }}
              >
                {detectScenesMutation.isPending ? 'Detecting Scenes...' : 'Re-detect Scenes'}
              </button>
            )}
          </div>

          {scenesLoading ? (
            <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.875rem' }}>Loading detected scenes...</p>
          ) : !scenesData || scenesData.scenes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.875rem' }}>
              No scene boundaries detected or processing in progress.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '1rem',
            }}>
              {scenesData.scenes.map((scene) => {
                const thumbUrl = getAssetUrl(scene.thumbnail_path)

                return (
                  <div
                    key={scene.id}
                    onClick={() => handleSeek(scene.start_time)}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'transform 0.2s, border-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#818cf8'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    {thumbUrl ? (
                      <img
                        src={thumbUrl}
                        alt={`Scene ${scene.scene_index + 1}`}
                        style={{
                          width: '100%',
                          height: '120px',
                          objectFit: 'cover',
                          display: 'block',
                          backgroundColor: '#000',
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '120px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        color: 'rgba(255,255,255,0.3)',
                        fontSize: '0.75rem',
                      }}>
                        No Thumbnail
                      </div>
                    )}

                    <div style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
                          Scene #{scene.scene_index + 1}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 500 }}>
                          {scene.duration.toFixed(1)}s
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                        {formatTime(scene.start_time)} → {formatTime(scene.end_time)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Visual Keyframes & Multimodal Vectors */}
        <div style={{
          marginTop: '2rem',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '1.5rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
                Indexed Visual Keyframes ({keyframesData?.total_keyframes || 0} vectors)
              </h2>
              <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                OpenCLIP ViT-B/32 multimodal feature vectors stored in ChromaDB vector index
              </p>
            </div>

            {media.status === 'ready' && (
              <button
                onClick={() => indexVisualMutation.mutate()}
                disabled={indexVisualMutation.isPending}
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.8rem',
                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  color: '#a5b4fc',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  borderRadius: '6px',
                  cursor: indexVisualMutation.isPending ? 'not-allowed' : 'pointer',
                }}
              >
                {indexVisualMutation.isPending ? 'Indexing Vectors...' : 'Re-index Visuals'}
              </button>
            )}
          </div>

          {keyframesLoading ? (
            <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.875rem' }}>Loading indexed keyframes...</p>
          ) : !keyframesData || keyframesData.keyframes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.875rem' }}>
              No visual keyframes indexed yet.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '1rem',
            }}>
              {keyframesData.keyframes.map((kf) => {
                const kfUrl = getAssetUrl(kf.file_path)

                return (
                  <div
                    key={kf.id}
                    onClick={() => handleSeek(kf.timestamp)}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transition: 'transform 0.2s, border-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#6366f1'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                      e.currentTarget.style.transform = 'translateY(0)'
                    }}
                  >
                    <img
                      src={kfUrl}
                      alt={`Keyframe at ${kf.timestamp}s`}
                      style={{
                        width: '100%',
                        height: '100px',
                        objectFit: 'cover',
                        display: 'block',
                        backgroundColor: '#000',
                      }}
                    />
                    <div style={{ padding: '0.5rem 0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a5b4fc' }}>
                          ▶ {formatTime(kf.timestamp)}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                          Frame #{kf.frame_index + 1}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}



function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '0.5rem 0',
      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    }}>
      <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>{label}</span>
      <span style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

