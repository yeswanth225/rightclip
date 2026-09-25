import { api } from './api'
import type {
  KeyframeListResponse,
  MediaAsset,
  MediaUploadResponse,
  MediaURLIngestRequest,
  SceneListResponse,
  Transcript,
  VisualSearchResponse,
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

  // Get keyframes
  async getKeyframes(mediaId: number, sceneId?: number): Promise<KeyframeListResponse> {
    const response = await api.get(`/api/media/${mediaId}/keyframes`, {
      params: sceneId !== undefined ? { scene_id: sceneId } : undefined,
    })
    return response.data
  },

  // Trigger visual indexing
  async triggerVisualIndexing(mediaId: number): Promise<KeyframeListResponse> {
    const response = await api.post(`/api/media/${mediaId}/index-visual`)
    return response.data
  },

  // Visual semantic search
  async searchVisual(query: string, mediaId?: number, topK = 10): Promise<VisualSearchResponse> {
    const response = await api.get('/api/visual/search', {
      params: {
        q: query,
        ...(mediaId !== undefined ? { media_id: mediaId } : {}),
        top_k: topK,
      },
    })
    return response.data
  },
}



