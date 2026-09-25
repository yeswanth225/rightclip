"""Scene schemas for API request and response validation"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class SceneResponse(BaseModel):
    """Schema for detected video scene response"""
    model_config = ConfigDict(from_attributes=True)

    id: int
    media_id: int
    scene_index: int
    start_time: float
    end_time: float
    duration: float
    thumbnail_path: Optional[str] = None
    thumbnail_time: Optional[float] = None
    detector: str
    score: Optional[float] = None
    created_at: datetime


class SceneListResponse(BaseModel):
    """Schema for scene collection response with statistics"""
    media_id: int
    total_scenes: int
    scenes: List[SceneResponse]
