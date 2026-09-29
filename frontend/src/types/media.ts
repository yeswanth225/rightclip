export interface MediaAsset {
  id: number
  filename: string
  source_type: string
  source_url?: string
  status: string
  file_path?: string
  proxy_path?: string
  thumbnail_path?: string
  file_size?: number
  duration?: number
  width?: number
  height?: number
  fps?: number
  video_codec?: string
  audio_codec?: string
  error_message?: string
  created_at: string
  updated_at?: string
}

export interface HealthCheck {
  status: string
  version: string
  timestamp: string
}

export interface MediaUploadResponse {
  id: number
  filename: string
  status: string
  message: string
}

export interface MediaURLIngestRequest {
  url: string
}

export interface TranscriptSegment {
  id: number
  transcript_id: number
  media_id: number
  segment_index: number
  start_time: number
  end_time: number
  text: string
  avg_logprob?: number
  no_speech_prob?: number
}

export interface Transcript {
  id: number
  media_id: number
  status: 'pending' | 'transcribing' | 'completed' | 'failed' | 'skipped'
  language?: string
  language_probability?: number
  duration?: number
  full_text?: string
  provider: string
  model_name: string
  error_message?: string
  created_at: string
  updated_at?: string
  segments: TranscriptSegment[]
}

export interface Scene {
  id: number
  media_id: number
  scene_index: number
  start_time: number
  end_time: number
  duration: number
  thumbnail_path?: string
  thumbnail_time?: number
  detector: string
  score?: number
  created_at: string
}

export interface SceneListResponse {
  media_id: number
  total_scenes: number
  scenes: Scene[]
}

export interface Keyframe {
  id: number
  media_id: number
  scene_id: number
  timestamp: number
  frame_index: number
  file_path: string
  vector_id?: string
  created_at: string
}

export interface KeyframeListResponse {
  media_id: number
  scene_id?: number
  total_keyframes: number
  keyframes: Keyframe[]
}

export interface VisualSearchMatch {
  keyframe_id: number
  media_id: number
  scene_id: number
  timestamp: number
  file_path: string
  similarity_score: number
  vector_id: string
}

export interface VisualSearchResponse {
  query: string
  total_results: number
  latency_ms: number
  results: VisualSearchMatch[]
}

export type SearchModeType = 'hybrid' | 'action' | 'dialogue' | 'visual' | 'person'

export interface SearchMatchEvidence {
  transcript_text?: string
  transcript_segment_id?: number
  transcript_score: number
  keyframe_id?: number
  keyframe_path?: string
  visual_similarity: number
  person_score?: number
  action_score?: number
  agreement: boolean
  match_types?: string[]
  explanation: string
}

export interface UnifiedSearchResult {
  media_id: number
  media_filename: string
  scene_id?: number
  scene_index?: number
  start_time: number
  end_time: number
  representative_timestamp: number
  thumbnail_path?: string
  score: number
  evidence: SearchMatchEvidence
}

export interface UnifiedSearchResponse {
  query: string
  mode: SearchModeType | string
  total_results: number
  latency_ms: number
  transcript_latency_ms: number
  visual_latency_ms: number
  person_latency_ms?: number
  fusion_latency_ms: number
  results: UnifiedSearchResult[]
}

export interface Clip {
  id: number
  media_id: number
  title: string
  start_time: number
  end_time: number
  duration: number
  search_query?: string
  evidence_json?: Record<string, any>
  created_at: string
  updated_at?: string
}

export interface ClipListResponse {
  media_id: number
  total_clips: number
  clips: Clip[]
}

export interface ClipExportResponse {
  clip_id?: number
  media_id: number
  title: string
  start_time: number
  end_time: number
  duration: number
  export_path: string
  download_url: string
}

