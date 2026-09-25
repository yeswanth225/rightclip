"""Database models"""

from datetime import datetime
from enum import Enum

from sqlalchemy import Column, DateTime, Integer, String, Text, Float, JSON
from sqlalchemy.sql import func

from app.core.database import Base


class MediaSourceType(str, Enum):
    """Media source types"""
    UPLOAD = "upload"
    URL = "url"


class MediaStatus(str, Enum):
    """Media processing status"""
    UPLOADED = "uploaded"
    DOWNLOADING = "downloading"
    VALIDATING = "validating"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class MediaAsset(Base):
    """Media asset model"""

    __tablename__ = "media_assets"

    id = Column(Integer, primary_key=True, index=True)

    # Source information
    filename = Column(String(255), nullable=False)
    source_type = Column(String(20), nullable=False)  # upload or url
    source_url = Column(Text, nullable=True)  # Original URL if applicable

    # Status
    status = Column(String(20), nullable=False, default=MediaStatus.UPLOADED)

    # File information
    file_path = Column(Text, nullable=True)  # Path to original file
    proxy_path = Column(Text, nullable=True)  # Path to proxy file
    thumbnail_path = Column(Text, nullable=True)  # Path to thumbnail
    file_size = Column(Integer, nullable=True)  # Size in bytes

    # Metadata (will be populated during processing)
    duration = Column(Float, nullable=True)  # Duration in seconds
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    fps = Column(Float, nullable=True)
    video_codec = Column(String(50), nullable=True)
    audio_codec = Column(String(50), nullable=True)
    metadata_json = Column(JSON, nullable=True)  # Additional metadata

    # Processing information
    error_message = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    def __repr__(self):
        return f"<MediaAsset(id={self.id}, filename='{self.filename}', status='{self.status}')>"
