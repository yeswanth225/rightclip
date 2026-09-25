"""Transcript and segment models"""

from datetime import datetime
from enum import Enum
from typing import List, Optional

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class TranscriptStatus(str, Enum):
    """Transcription status"""
    PENDING = "pending"
    TRANSCRIBING = "transcribing"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"  # e.g., video has no audio track


class Transcript(Base):
    """Transcript model associated with a MediaAsset"""

    __tablename__ = "transcripts"

    id = Column(Integer, primary_key=True, index=True)
    media_id = Column(Integer, ForeignKey("media_assets.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)

    # Transcription status & metadata
    status = Column(String(20), nullable=False, default=TranscriptStatus.PENDING)
    language = Column(String(10), nullable=True)  # detected language code e.g. "en"
    language_probability = Column(Float, nullable=True)
    duration = Column(Float, nullable=True)
    full_text = Column(Text, nullable=True)
    provider = Column(String(50), nullable=False, default="faster-whisper")
    model_name = Column(String(50), nullable=False, default="base")
    error_message = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Relationships
    media = relationship("MediaAsset", back_populates="transcript")
    segments = relationship(
        "TranscriptSegment",
        back_populates="transcript",
        cascade="all, delete-orphan",
        order_by="TranscriptSegment.start_time",
    )

    def __repr__(self):
        return f"<Transcript(id={self.id}, media_id={self.media_id}, status='{self.status}')>"


class TranscriptSegment(Base):
    """Timestamped segment/chunk of a transcript"""

    __tablename__ = "transcript_segments"

    id = Column(Integer, primary_key=True, index=True)
    transcript_id = Column(Integer, ForeignKey("transcripts.id", ondelete="CASCADE"), nullable=False, index=True)
    media_id = Column(Integer, ForeignKey("media_assets.id", ondelete="CASCADE"), nullable=False, index=True)

    # Timing
    segment_index = Column(Integer, nullable=False)  # 0, 1, 2...
    start_time = Column(Float, nullable=False, index=True)  # in seconds
    end_time = Column(Float, nullable=False, index=True)    # in seconds

    # Content
    text = Column(Text, nullable=False)
    avg_logprob = Column(Float, nullable=True)
    no_speech_prob = Column(Float, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    transcript = relationship("Transcript", back_populates="segments")
    media = relationship("MediaAsset", back_populates="transcript_segments")

    __table_args__ = (
        Index("ix_transcript_segments_media_start", "media_id", "start_time"),
    )

    def __repr__(self):
        return (
            f"<TranscriptSegment(id={self.id}, media_id={self.media_id}, "
            f"start={self.start_time:.2f}, end={self.end_time:.2f}, text='{self.text[:20]}...')>"
        )
