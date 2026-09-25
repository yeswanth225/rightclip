"""Pydantic schemas for API validation"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator


class MediaAssetBase(BaseModel):
    """Base media asset schema"""
    filename: str
    source_type: str


class MediaAssetCreate(MediaAssetBase):
    """Schema for creating a media asset"""
    source_url: Optional[str] = None


class MediaUploadResponse(BaseModel):
    """Response for media upload"""
    id: int
    filename: str
    status: str
    message: str


class MediaURLIngestRequest(BaseModel):
    """Request schema for URL ingestion"""
    url: str

    @field_validator("url")
    @classmethod
    def validate_url_format(cls, v: str) -> str:
        """Validate URL format"""
        if not v:
            raise ValueError("URL is required")
        if not v.startswith(("http://", "https://")):
            raise ValueError("URL must start with http:// or https://")
        return v


class MediaAssetResponse(MediaAssetBase):
    """Schema for media asset responses"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    source_url: Optional[str] = None
    file_path: Optional[str] = None
    proxy_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    file_size: Optional[int] = None
    duration: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None
    fps: Optional[float] = None
    video_codec: Optional[str] = None
    audio_codec: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class HealthCheckResponse(BaseModel):
    """Health check response schema"""
    status: str
    version: str
    timestamp: datetime
