import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { mediaService } from '../services/mediaService'
import { getAssetUrl } from '../utils/assets'
import type { UnifiedSearchResult, SearchModeType } from '../types/media'

export default function SearchPage() {
  const navigate = useNavigate()
  const [queryInput, setQueryInput] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [searchMode, setSearchMode] = useState<SearchModeType>('hybrid')
  const [selectedResult, setSelectedResult] = useState<UnifiedSearchResult | null>(null)
  
  // Reference Image state
  const [referenceImageB64, setReferenceImageB64] = useState<string | null>(null)
  const [referenceImageName, setReferenceImageName] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // Query search execution
  const hasValidQuery = !!activeQuery.trim() || !!referenceImageB64

  const { data: searchData, isLoading, isError, error } = useQuery({
    queryKey: ['search', activeQuery, searchMode, referenceImageB64],
    queryFn: () => mediaService.searchUnified(activeQuery, undefined, searchMode, 25, referenceImageB64 || undefined),
    enabled: hasValidQuery,
    staleTime: 30000,
  })

  const { data: mediaList } = useQuery({
    queryKey: ['media'],
    queryFn: () => mediaService.listMedia(0, 50),
  })

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (queryInput.trim() || referenceImageB64) {
      setActiveQuery(queryInput.trim())
      setSelectedResult(null)
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
        // Automatically activate Person mode if no query typed yet
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
    if (videoRef.current) {
      videoRef.current.currentTime = result.representative_timestamp
      videoRef.current.play().catch(() => {})
    }
  }

  const activeMedia = selectedResult
    ? (mediaList || []).find((m) => m.id === selectedResult.media_id)
    : null

  const proxyUrl = getAssetUrl(activeMedia?.proxy_path || activeMedia?.file_path)

  const modes: { id: SearchModeType; label: string; desc: string }[] = [
    { id: 'hybrid', label: 'Everything', desc: 'Multimodal automatic fusion' },
    { id: 'action', label: 'Actions / Events', desc: 'Physical actions, motion sequences' },
    { id: 'dialogue', label: 'Dialogue', desc: 'Exact & semantic spoken speech' },
    { id: 'visual', label: 'Visual Scenes', desc: 'Visual concepts and objects' },
    { id: 'person', label: 'Person / Reference', desc: 'Face & identity appearance search' },
  ]

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '2.5rem 1.5rem 4rem' }}>
      {/* Central Search Workspace Header */}
      <div style={{ marginBottom: '2.5rem', maxWidth: '820px', margin: '0 auto 2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--text-pure)',
            marginBottom: '0.4rem',
          }}>
            Multimodal Search Workspace
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Find exact temporal moments by describing actions, dialogue quotes, visual scenes, or uploading reference images.
          </p>
        </div>

        {/* Search Box Form */}
        <form onSubmit={handleSearchSubmit}>
          <div style={{
            backgroundColor: 'var(--bg-surface-1)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-lg)',
            padding: '0.75rem 1rem',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            transition: 'border-color 0.2s',
          }}>
            {/* Reference Image Tag (if uploaded) */}
            {referenceImageB64 && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.6rem',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.35rem 0.65rem',
                marginBottom: '0.6rem',
              }}>
                <img
                  src={referenceImageB64}
                  alt="Reference"
                  style={{ width: '26px', height: '26px', borderRadius: '4px', objectFit: 'cover' }}
                />
                <span style={{ fontSize: '0.8rem', color: '#a5b4fc', fontWeight: 500 }}>
                  Reference: {referenceImageName || 'Photo'}
                </span>
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  style={{
                    background: 'transparent',
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: '0.9rem',
                    padding: '0 4px',
                  }}
                  title="Remove reference photo"
                >
                  ✕
                </button>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <input
                type="text"
                placeholder={
                  referenceImageB64
                    ? "e.g. 'when this person enters the room' or 'says they are leaving'"
                    : "e.g. 'character opens the car door and gets inside' or 'we need to leave now'"
                }
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-pure)',
                  fontSize: '1.05rem',
                  padding: '0.4rem 0',
                }}
              />

              {/* Reference Image Button */}
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
                title="Upload person or image reference"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  backgroundColor: referenceImageB64 ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                  color: referenceImageB64 ? '#a5b4fc' : 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                📷 {referenceImageB64 ? 'Change Ref' : '+ Ref Image'}
              </button>

              <button
                type="submit"
                disabled={isLoading || (!queryInput.trim() && !referenceImageB64)}
                style={{
                  padding: '0.65rem 1.4rem',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--accent-primary)',
                  color: '#fff',
                  borderRadius: 'var(--radius-sm)',
                  opacity: isLoading || (!queryInput.trim() && !referenceImageB64) ? 0.6 : 1,
                  cursor: isLoading || (!queryInput.trim() && !referenceImageB64) ? 'not-allowed' : 'pointer',
                }}
              >
                {isLoading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

          {/* Mode Selector Tabs */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.5rem',
            marginTop: '1rem',
            flexWrap: 'wrap',
          }}>
            {modes.map((m) => {
              const active = searchMode === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSearchMode(m.id)}
                  style={{
                    padding: '0.4rem 0.85rem',
                    fontSize: '0.8rem',
                    fontWeight: active ? 600 : 400,
                    color: active ? 'var(--text-pure)' : 'var(--text-secondary)',
                    backgroundColor: active ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-surface-0)',
                    border: active ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-pill)',
                  }}
                  title={m.desc}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
        </form>
      </div>

      {/* Synchronized Moment Previewer Player */}
      {selectedResult && (
        <div style={{
          backgroundColor: 'var(--bg-surface-0)',
          border: '1px solid var(--accent-primary)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem',
          marginBottom: '2.5rem',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6)',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-pure)' }}>
                  {selectedResult.media_filename}
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  color: '#a5b4fc',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 500,
                }}>
                  Clip: {formatTime(selectedResult.start_time)} – {formatTime(selectedResult.end_time)}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {selectedResult.evidence.explanation}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--accent-primary)',
                  color: '#fff',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                ✂️ Edit Boundaries
              </button>
              <button
                onClick={() => navigate(`/media/${selectedResult.media_id}`)}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.85rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                Inspect Video →
              </button>
            </div>
          </div>

          {proxyUrl ? (
            <video
              ref={videoRef}
              src={proxyUrl}
              controls
              autoPlay
              style={{ width: '100%', maxHeight: '440px', borderRadius: 'var(--radius-md)', backgroundColor: '#000' }}
            />
          ) : (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              Proxy video stream unavailable for preview.
            </div>
          )}
        </div>
      )}

      {/* Metrics Banner */}
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
        }}>
          <div>
            Retrieved <strong style={{ color: 'var(--text-pure)' }}>{searchData.total_results}</strong> relevant moments for "{searchData.query}"
          </div>
          <div style={{ display: 'flex', gap: '1rem', fontFamily: 'JetBrains Mono, monospace' }}>
            <span>Latency: <strong style={{ color: '#818cf8' }}>{searchData.latency_ms}ms</strong></span>
            <span>Dialogue: {searchData.transcript_latency_ms}ms</span>
            <span>Visual: {searchData.visual_latency_ms}ms</span>
            {searchData.person_latency_ms !== undefined && (
              <span>Person: {searchData.person_latency_ms}ms</span>
            )}
          </div>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div style={{
          padding: '1rem',
          backgroundColor: 'rgba(244, 63, 94, 0.1)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          borderRadius: 'var(--radius-md)',
          color: '#fb7185',
          marginBottom: '1.5rem',
          fontSize: '0.9rem',
        }}>
          Search failed: {String(error)}
        </div>
      )}

      {/* Empty Results State */}
      {searchData && searchData.results.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>No matching moments found</p>
          <p style={{ fontSize: '0.85rem' }}>Try broader terms, another retrieval mode, or attach a different reference image.</p>
        </div>
      )}

      {/* Search Results Moment Grid */}
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
                  backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-surface-0)',
                  border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-strong)'
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-subtle)'
                }}
              >
                {/* Moment Thumbnail Card */}
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
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                      No Frame
                    </div>
                  )}
                  <div style={{
                    position: 'absolute',
                    bottom: '6px',
                    right: '6px',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: '#fff',
                    fontWeight: 500,
                  }}>
                    ▶ {formatTime(result.representative_timestamp)}
                  </div>
                </div>

                {/* Evidence & Content Details */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    {/* Header line with filename, scene, range, and modality tags */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-pure)' }}>
                        {result.media_filename}
                      </span>
                      {result.scene_index !== undefined && result.scene_index !== null && (
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '2px 6px',
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
                        fontWeight: 500,
                      }}>
                        {formatTime(result.start_time)} – {formatTime(result.end_time)}
                      </span>

                      {/* Evidence Modality Badges */}
                      <div style={{ display: 'flex', gap: '0.3rem', marginLeft: 'auto' }}>
                        {matchBadges.map((tag) => (
                          <span
                            key={tag}
                            style={{
                              fontSize: '0.65rem',
                              textTransform: 'uppercase',
                              fontWeight: 700,
                              letterSpacing: '0.04em',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor:
                                tag === 'dialogue'
                                  ? 'rgba(6, 182, 212, 0.15)'
                                  : tag === 'action'
                                  ? 'rgba(245, 158, 11, 0.15)'
                                  : tag === 'person'
                                  ? 'rgba(168, 85, 247, 0.15)'
                                  : 'rgba(99, 102, 241, 0.15)',
                              color:
                                tag === 'dialogue'
                                  ? '#22d3ee'
                                  : tag === 'action'
                                  ? '#fbbf24'
                                  : tag === 'person'
                                  ? '#c084fc'
                                  : '#a5b4fc',
                            }}
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
                        paddingLeft: '0.6rem',
                      }}>
                        "{result.evidence.transcript_text}"
                      </div>
                    )}

                    {/* Concise Evidence Explanation */}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {result.evidence.explanation}
                    </div>
                  </div>
                </div>

                {/* Actions & Score */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Match Score
                  </div>
                  <div style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    fontFamily: 'JetBrains Mono, monospace',
                    color: 'var(--accent-primary)',
                  }}>
                    {result.score.toFixed(3)}
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSeek(result)
                      }}
                      style={{
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.75rem',
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        color: '#a5b4fc',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    >
                      ▶ Preview
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
                      ✂️ Edit Clip
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
