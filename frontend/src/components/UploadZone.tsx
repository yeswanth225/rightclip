import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useMutation } from '@tanstack/react-query'
import {
  UploadSimple,
  VideoCamera,
  SpinnerGap,
  CheckCircle,
  WarningCircle,
} from '@phosphor-icons/react'
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
        setError('')
        uploadMutation.mutate(acceptedFiles[0])
      }
    },
  })

  return (
    <div style={{ width: '100%' }}>
      <div
        {...getRootProps()}
        style={{
          border: isDragActive
            ? '2px dashed var(--accent-primary)'
            : '1px dashed var(--border-strong)',
          borderRadius: 'var(--radius-md)',
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          cursor: uploadMutation.isPending ? 'not-allowed' : 'pointer',
          backgroundColor: isDragActive
            ? 'var(--accent-primary-subtle)'
            : 'var(--bg-surface-1)',
          transition: 'all 0.15s ease',
          boxShadow: isDragActive ? 'var(--shadow-glow)' : 'none',
        }}
      >
        <input {...getInputProps()} />

        {uploadMutation.isPending ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <SpinnerGap size={36} className="anim-pulse" color="#818cf8" />
            <div>
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-pure)' }}>
                Uploading Video File...
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Extracting metadata, creating 720p proxy & indexing keyframes
              </p>
            </div>
          </div>
        ) : isDragActive ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <UploadSimple size={36} color="#818cf8" weight="bold" />
            <p style={{ fontSize: '1rem', fontWeight: 600, color: '#a5b4fc' }}>
              Drop video to start multimodal indexing
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
            }}>
              <VideoCamera size={24} />
            </div>

            <div>
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-pure)', marginBottom: '0.2rem' }}>
                Drag & drop a video file, or <span style={{ color: '#818cf8' }}>browse</span>
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Supports MP4, MKV, MOV, WebM, AVI · Up to 500MB
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem 1rem',
          backgroundColor: 'var(--accent-rose-subtle)',
          border: '1px solid var(--accent-rose-border)',
          borderRadius: 'var(--radius-sm)',
          color: '#fb7185',
          fontSize: '0.82rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <WarningCircle size={18} weight="bold" />
          <span>{error}</span>
        </div>
      )}

      {uploadMutation.isSuccess && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem 1rem',
          backgroundColor: 'var(--accent-emerald-subtle)',
          border: '1px solid var(--accent-emerald-border)',
          borderRadius: 'var(--radius-sm)',
          color: '#34d399',
          fontSize: '0.82rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <CheckCircle size={18} weight="bold" />
          <span>Upload successful. Processing media pipeline...</span>
        </div>
      )}
    </div>
  )
}
