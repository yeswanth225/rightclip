"""Transcript schemas for request and response validation"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class TranscriptSegmentResponse(BaseModel):
    """Schema for timestamped transcript segment response"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    transcript_id: int
    media_id: int
    segment_index: int
    start_time: float
    end_time: float
    text: str
    avg_logprob: Optional[float] = None
    no_speech_prob: Optional[float] = None


class TranscriptResponse(BaseModel):
    """Schema for full transcript response"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    media_id: int
    status: str
    language: Optional[str] = None
    language_probability: Optional[float] = None
    duration: Optional[float] = None
    full_text: Optional[str] = None
    provider: str
    model_name: str
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    segments: List[TranscriptSegmentResponse] = []
