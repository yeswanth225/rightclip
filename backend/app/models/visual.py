"""Keyframe database model"""

from datetime import datetime
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Keyframe(Base):
    """Extracted visual keyframe within a detected scene with vector mapping"""

    __tablename__ = "keyframes"

    id = Column(Integer, primary_key=True, index=True)
    media_id = Column(Integer, ForeignKey("media_assets.id", ondelete="CASCADE"), nullable=False, index=True)
    scene_id = Column(Integer, ForeignKey("scenes.id", ondelete="CASCADE"), nullable=False, index=True)

    # Frame timing & location
    timestamp = Column(Float, nullable=False, index=True)      # Timestamp in video (seconds)
    frame_index = Column(Integer, nullable=False)              # Index sequence within scene (0, 1, 2)
    file_path = Column(Text, nullable=False)                   # Relative filesystem path to JPG keyframe
    
    # Vector DB reference
    vector_id = Column(String(64), nullable=True, unique=True, index=True)  # ChromaDB unique document ID

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    media = relationship("MediaAsset", back_populates="keyframes")
    scene = relationship("Scene", back_populates="keyframes")

    __table_args__ = (
        Index("ix_keyframes_media_scene_time", "media_id", "scene_id", "timestamp"),
    )

    def __repr__(self):
        return (
            f"<Keyframe(id={self.id}, media_id={self.media_id}, scene_id={self.scene_id}, "
            f"timestamp={self.timestamp:.2f}s, vector_id='{self.vector_id}')>"
        )
