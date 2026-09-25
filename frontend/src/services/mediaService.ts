import { api } from './api'
import type {
  MediaAsset,
  MediaUploadResponse,
  MediaURLIngestRequest,
  SceneListResponse,
  Transcript,
} from '../types/media'

export const mediaService = {
  // List media assets
  async listMedia(skip = 0, limit = 20): Promise<MediaAsset[]> {
    const response = await api.get('/api/media', {
      params: { skip, limit },
    })
    return response.data
  },

  // Get single media asset
  async getMedia(id: number): Promise<MediaAsset> {
    const response = await api.get(`/api/media/${id}`)
    return response.data
  },

  // Upload media file
  async uploadMedia(file: File): Promise<MediaUploadResponse> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await api.post('/api/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  // Ingest media from URL
  async ingestURL(url: string): Promise<MediaUploadResponse> {
    const response = await api.post<MediaUploadResponse>('/api/media/url', {
      url,
    } as MediaURLIngestRequest)
    return response.data
  },

  // Get transcript
  async getTranscript(mediaId: number): Promise<Transcript> {
    const response = await api.get(`/api/media/${mediaId}/transcript`)
    return response.data
  },

  // Trigger transcription
  async triggerTranscription(mediaId: number, language?: string): Promise<Transcript> {
    const response = await api.post(`/api/media/${mediaId}/transcribe`, null, {
      params: language ? { language } : undefined,
    })
    return response.data
  },

  // Get scenes
  async getScenes(mediaId: number): Promise<SceneListResponse> {
    const response = await api.get(`/api/media/${mediaId}/scenes`)
    return response.data
  },

  // Trigger scene detection
  async triggerSceneDetection(mediaId: number, detectorType?: string, threshold?: number): Promise<SceneListResponse> {
    const response = await api.post(`/api/media/${mediaId}/scenes/detect`, null, {
      params: {
        ...(detectorType ? { detector_type: detectorType } : {}),
        ...(threshold ? { threshold } : {}),
      },
    })
    return response.data
  },
}


