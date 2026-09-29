"""Clip Pydantic schemas for Phase 7 clip editing and saved selections"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, model_validator


class ClipCreate(BaseModel):
    """Schema for creating a clip"""

    media_id: int = Field(..., description="Target media asset ID")
    title: str = Field(default="Untitled Clip", max_length=255, description="Clip title")
    start_time: float = Field(..., ge=0.0, description="Start timestamp in seconds")
    end_time: float = Field(..., gt=0.0, description="End timestamp in seconds")
    search_query: Optional[str] = Field(default=None, max_length=255, description="Original discovery query")
    evidence_json: Optional[Dict[str, Any]] = Field(default=None, description="Search evidence details")

    @model_validator(mode="after")
    def validate_range(self):
        if self.start_time >= self.end_time:
            raise ValueError("start_time must be strictly less than end_time")
        return self


class ClipUpdate(BaseModel):
    """Schema for updating an existing clip boundary or title"""

    title: Optional[str] = Field(default=None, max_length=255)
    start_time: Optional[float] = Field(default=None, ge=0.0)
    end_time: Optional[float] = Field(default=None, gt=0.0)

    @model_validator(mode="after")
    def validate_range(self):
        if self.start_time is not None and self.end_time is not None:
            if self.start_time >= self.end_time:
                raise ValueError("start_time must be strictly less than end_time")
        return self


class ClipResponse(BaseModel):
    """Schema for returning clip information"""

    id: int
    media_id: int
    title: str
    start_time: float
    end_time: float
    duration: float
    search_query: Optional[str] = None
    evidence_json: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ClipListResponse(BaseModel):
    """List of clips for a media asset"""

    media_id: int
    total_clips: int
    clips: List[ClipResponse]


class ClipExportRequest(BaseModel):
    """Schema for requesting a physical MP4 export of an arbitrary moment"""

    start_time: float = Field(..., ge=0.0, description="Start timestamp in seconds")
    end_time: float = Field(..., gt=0.0, description="End timestamp in seconds")
    title: Optional[str] = Field(default="Exported Moment", max_length=255)
