"""Scene database model"""

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class SceneStatus(str, Enum):
    """Scene detection status for media"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Scene(Base):
    """Detected video scene segment with timing and thumbnail reference"""

    __tablename__ = "scenes"

    id = Column(Integer, primary_key=True, index=True)
    media_id = Column(Integer, ForeignKey("media_assets.id", ondelete="CASCADE"), nullable=False, index=True)

    # Sequence & Timing
    scene_index = Column(Integer, nullable=False)  # 0, 1, 2...
    start_time = Column(Float, nullable=False, index=True)  # in seconds
    end_time = Column(Float, nullable=False, index=True)    # in seconds
    duration = Column(Float, nullable=False)                # in seconds

    # Visual assets
    thumbnail_path = Column(Text, nullable=True)  # Path to representative scene frame
    thumbnail_time = Column(Float, nullable=True)  # Exact timestamp of thumbnail

    # Detection metadata
    detector = Column(String(50), nullable=False, default="pyscenedetect")
    score = Column(Float, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    media = relationship("MediaAsset", back_populates="scenes")

    __table_args__ = (
        Index("ix_scenes_media_start", "media_id", "start_time"),
        Index("ix_scenes_media_index", "media_id", "scene_index"),
    )

    def __repr__(self):
        return (
            f"<Scene(id={self.id}, media_id={self.media_id}, index={self.scene_index}, "
            f"start={self.start_time:.2f}s, end={self.end_time:.2f}s, duration={self.duration:.2f}s)>"
        )
