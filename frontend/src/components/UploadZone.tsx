import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useMutation } from '@tanstack/react-query'
import { mediaService } from '../services/mediaService'

interface UploadZoneProps {
  onUploadSuccess?: (mediaId: number) => void
}

export default function UploadZone({ onUploadSuccess }: UploadZoneProps) {
  const [error, setError] = useState<string>('')

  const uploadMutation = useMutation({
    mutationFn: (file: File) => mediaService.uploadMedia(file),
    onSuccess: (data) => {
      setError('')
      if (onUploadSuccess) {
        onUploadSuccess(data.id)
      }
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Upload failed')
    },
  })

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'video/*': ['.mp4', '.mkv', '.mov', '.webm', '.avi'],
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        uploadMutation.mutate(acceptedFiles[0])
      }
    },
  })

  return (
    <div style={{ width: '100%' }}>
      <div
        {...getRootProps()}
        style={{
          border: '2px dashed rgba(255, 255, 255, 0.3)',
          borderRadius: '12px',
          padding: '3rem 2rem',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: isDragActive
            ? 'rgba(100, 108, 255, 0.1)'
            : 'rgba(255, 255, 255, 0.02)',
          transition: 'all 0.2s',
        }}
      >
        <input {...getInputProps()} />

        {uploadMutation.isPending ? (
          <div>
            <div
              style={{
                fontSize: '2rem',
                marginBottom: '1rem',
              }}
            >
              ⏳
            </div>
            <p style={{ fontSize: '1.125rem', color: 'rgba(255, 255, 255, 0.9)' }}>
              Uploading...
            </p>
          </div>
        ) : isDragActive ? (
          <div>
            <div
              style={{
                fontSize: '2rem',
                marginBottom: '1rem',
              }}
            >
              📁
            </div>
            <p style={{ fontSize: '1.125rem', color: 'rgba(255, 255, 255, 0.9)' }}>
              Drop your video here
            </p>
          </div>
        ) : (
          <div>
            <div
              style={{
                fontSize: '2rem',
                marginBottom: '1rem',
              }}
            >
              🎬
            </div>
            <p style={{ fontSize: '1.125rem', color: 'rgba(255, 255, 255, 0.9)', marginBottom: '0.5rem' }}>
              Drag & drop a video file
            </p>
            <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.5)' }}>
              or click to browse
            </p>
            <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.4)', marginTop: '1rem' }}>
              Supported: MP4, MKV, MOV, WebM, AVI
            </p>
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: 'rgba(220, 38, 38, 0.1)',
            border: '1px solid rgba(220, 38, 38, 0.3)',
            borderRadius: '8px',
            color: '#ff6b6b',
          }}
        >
          {error}
        </div>
      )}

      {uploadMutation.isSuccess && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '8px',
            color: '#4ade80',
          }}
        >
          Upload successful! Processing video...
        </div>
      )}
    </div>
  )
}
