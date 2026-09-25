"""Pydantic schemas for API validation"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class MediaAssetBase(BaseModel):
    """Base media asset schema"""
    filename: str
    source_type: str


class MediaAssetCreate(MediaAssetBase):
    """Schema for creating a media asset"""
    source_url: Optional[str] = None


class MediaAssetResponse(MediaAssetBase):
    """Schema for media asset responses"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: str
    source_url: Optional[str] = None
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
