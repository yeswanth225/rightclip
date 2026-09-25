"""Clip database model for Phase 7 clip boundary adjustments and project state"""

from datetime import datetime
from typing import Optional

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Clip(Base):
    """
    Clip model representing an edited boundary segment of a media asset.
    """

    __tablename__ = "clips"

    id = Column(Integer, primary_key=True, index=True)
    media_id = Column(Integer, ForeignKey("media_assets.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(255), nullable=False, default="Untitled Clip")
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    duration = Column(Float, nullable=False)

    # Optional metadata capturing the discovery context (e.g. AI search evidence)
    search_query = Column(String(255), nullable=True)
    evidence_json = Column(JSON, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    media = relationship("MediaAsset", back_populates="clips")

    def __repr__(self):
        return f"<Clip(id={self.id}, media_id={self.media_id}, range={self.start_time:.2f}s-{self.end_time:.2f}s)>"
