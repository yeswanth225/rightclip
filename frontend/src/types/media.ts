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



