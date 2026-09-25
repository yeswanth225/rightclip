"""Visual keyframe and visual search response schemas"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class KeyframeResponse(BaseModel):
    """Schema for individual visual keyframe response"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    media_id: int
    scene_id: int
    timestamp: float
    frame_index: int
    file_path: str
    vector_id: Optional[str] = None
    created_at: datetime


class KeyframeListResponse(BaseModel):
    """Schema for collection of keyframes for a media asset or scene"""
    media_id: int
    scene_id: Optional[int] = None
    total_keyframes: int
    keyframes: List[KeyframeResponse]


class VisualSearchMatchResponse(BaseModel):
    """Schema for visual similarity query hit"""
    keyframe_id: int
    media_id: int
    scene_id: int
    timestamp: float
    file_path: str
    similarity_score: float
    vector_id: str


class VisualSearchResponse(BaseModel):
    """Schema for visual search response with benchmark metadata"""
    query: str
    total_results: int
    latency_ms: float
    results: List[VisualSearchMatchResponse]
