import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { mediaService } from '../services/mediaService'
import { getAssetUrl } from '../utils/assets'
import type { UnifiedSearchResult } from '../types/media'

export default function SearchPage() {
  const navigate = useNavigate()
  const [queryInput, setQueryInput] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [searchMode, setSearchMode] = useState<'hybrid' | 'transcript' | 'visual'>('hybrid')
  const [selectedResult, setSelectedResult] = useState<UnifiedSearchResult | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const { data: searchData, isLoading, isError, error } = useQuery({
    queryKey: ['search', activeQuery, searchMode],
    queryFn: () => mediaService.searchUnified(activeQuery, undefined, searchMode, 20),
    enabled: !!activeQuery.trim(),
    staleTime: 30000,
  })

  const { data: mediaList } = useQuery({
    queryKey: ['media'],
    queryFn: () => mediaService.listMedia(),
  })

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (queryInput.trim()) {
      setActiveQuery(queryInput.trim())
      setSelectedResult(null)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 10)
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`
  }

  const handleSeek = (result: UnifiedSearchResult) => {
    setSelectedResult(result)
    if (videoRef.current) {
      videoRef.current.currentTime = result.representative_timestamp
      videoRef.current.play().catch(() => {})
    }
  }

  // Determine current active media for player
  const activeMedia = selectedResult
    ? (mediaList || []).find((m) => m.id === selectedResult.media_id)
    : null

  const proxyUrl = getAssetUrl(activeMedia?.proxy_path || activeMedia?.file_path)

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem' }}>
      {/* Search Header & Input */}
      <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>
          Unified Multimodal Search
        </h1>
        <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '1rem', marginBottom: '2rem' }}>
          Search across spoken speech transcripts, visual keyframes, and scene moments in natural language.
        </p>

        <form onSubmit={handleSearchSubmit} style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="e.g. 'quantum computing blue background' or 'person flipping hair'"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              style={{
                flex: 1,
                padding: '0.85rem 1.25rem',
                fontSize: '1rem',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: '#fff',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !queryInput.trim()}
              style={{
                padding: '0.85rem 1.75rem',
                fontSize: '1rem',
                fontWeight: 600,
                backgroundColor: '#6366f1',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: isLoading || !queryInput.trim() ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
              }}
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Mode Selector */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)' }}>Retrieval Mode:</span>
            {(['hybrid', 'transcript', 'visual'] as const).map((m) => (
              <label
                key={m}
                style={{
                  fontSize: '0.85rem',
                  color: searchMode === m ? '#818cf8' : 'rgba(255, 255, 255, 0.7)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontWeight: searchMode === m ? 600 : 400,
                }}
              >
                <input
                  type="radio"
                  name="searchMode"
                  value={m}
                  checked={searchMode === m}
                  onChange={() => setSearchMode(m)}
                />
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </label>
            ))}
          </div>
        </form>
      </div>

      {/* Synchronized Video Player Preview */}
      {selectedResult && (
        <div style={{
          marginBottom: '2.5rem',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: '12px',
          padding: '1.5rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, color: '#fff' }}>
                Previewing Match: {selectedResult.media_filename}
              </h2>
              <span style={{ fontSize: '0.8rem', color: '#818cf8' }}>
                Interval: {formatTime(selectedResult.start_time)} – {formatTime(selectedResult.end_time)} (Jump: {formatTime(selectedResult.representative_timestamp)})
              </span>
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
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  backgroundColor: '#6366f1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)',
                }}
              >
                ✂️ Edit Clip
              </button>
              <button
                onClick={() => navigate(`/media/${selectedResult.media_id}`)}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.8rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#fff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Open Media →
              </button>
            </div>
          </div>

          {proxyUrl ? (
            <video
              ref={videoRef}
              src={proxyUrl}
              controls
              autoPlay
              style={{ width: '100%', maxHeight: '420px', borderRadius: '8px', backgroundColor: '#000' }}
            />
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem' }}>
              Proxy video not available for preview.
            </div>
          )}
        </div>
      )}

      {/* Latency / Benchmark Metrics Banner */}
      {searchData && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          fontSize: '0.8rem',
          color: 'rgba(255, 255, 255, 0.6)',
        }}>
          <div>
            Found <strong style={{ color: '#fff' }}>{searchData.total_results}</strong> candidate moments for "{searchData.query}"
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <span>Total: <strong style={{ color: '#818cf8' }}>{searchData.latency_ms} ms</strong></span>
            <span>Transcript: {searchData.transcript_latency_ms} ms</span>
            <span>Visual: {searchData.visual_latency_ms} ms</span>
            <span>Fusion: {searchData.fusion_latency_ms} ms</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div style={{
          padding: '1rem',
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          borderRadius: '8px',
          color: '#ff6b6b',
          marginBottom: '2rem',
        }}>
          Error executing search: {String(error)}
        </div>
      )}

      {/* Results List */}
      {searchData && searchData.results.length === 0 && (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'rgba(255, 255, 255, 0.4)' }}>
          No matching moments found. Try alternative keywords or broader descriptions.
        </div>
      )}

      {searchData && searchData.results.length > 0 && (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
          {searchData.results.map((result, idx) => {
            const thumbUrl = getAssetUrl(result.thumbnail_path)

            const isSelected = selectedResult === result

            return (
              <div
                key={`${result.media_id}-${result.start_time}-${idx}`}
                onClick={() => handleSeek(result)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '220px 1fr auto',
                  gap: '1.25rem',
                  backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                  border: isSelected ? '1px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '1rem',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s, border-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)'
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                }}
              >
                {/* Thumbnail Frame */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: '130px',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  backgroundColor: '#000',
                }}>
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt="Match Thumbnail"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>
                      No Frame
                    </div>
                  )}
                  <div style={{
                    position: 'absolute',
                    bottom: '6px',
                    right: '6px',
                    backgroundColor: 'rgba(0,0,0,0.75)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    color: '#fff',
                    fontWeight: 600,
                  }}>
                    ▶ {formatTime(result.representative_timestamp)}
                  </div>
                </div>

                {/* Evidence & Details */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>
                        {result.media_filename}
                      </span>
                      {result.scene_index !== undefined && result.scene_index !== null && (
                        <span style={{ fontSize: '0.75rem', padding: '2px 6px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '4px', color: 'rgba(255,255,255,0.7)' }}>
                          Scene #{result.scene_index + 1}
                        </span>
                      )}
                      <span style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 500 }}>
                        {formatTime(result.start_time)} – {formatTime(result.end_time)}
                      </span>
                      {result.evidence.agreement && (
                        <span style={{ fontSize: '0.7rem', padding: '2px 6px', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', borderRadius: '4px', fontWeight: 600 }}>
                          ✓ Multimodal Agreement
                        </span>
                      )}
                    </div>

                    {/* Transcript Quote */}
                    {result.evidence.transcript_text && (
                      <div style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.85)', marginBottom: '0.4rem', fontStyle: 'italic', borderLeft: '2px solid #818cf8', paddingLeft: '0.5rem' }}>
                        "{result.evidence.transcript_text}"
                      </div>
                    )}

                    {/* Explanation */}
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                      {result.evidence.explanation}
                    </div>
                  </div>
                </div>

                {/* Score Column */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
                    Rank Score
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#818cf8' }}>
                    {result.score.toFixed(3)}
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSeek(result)
                      }}
                      style={{
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.75rem',
                        backgroundColor: 'rgba(99, 102, 241, 0.2)',
                        color: '#a5b4fc',
                        border: '1px solid rgba(99, 102, 241, 0.4)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      ▶ Play
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
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        color: '#fff',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '4px',
                        cursor: 'pointer',
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
