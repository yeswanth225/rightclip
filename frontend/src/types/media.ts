export interface MediaAsset {
  id: number
  filename: string
  source_type: string
  source_url?: string
  status: string
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
