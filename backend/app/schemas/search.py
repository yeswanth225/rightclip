"""Unified Search Schemas"""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class SearchMode(str, Enum):
    """Supported search retrieval modes"""
    HYBRID = "hybrid"
    TRANSCRIPT = "transcript"
    VISUAL = "visual"


class SearchMatchEvidence(BaseModel):
    """Detailed evidence from individual retrieval providers"""
    transcript_text: Optional[str] = None
    transcript_segment_id: Optional[int] = None
    transcript_score: float = 0.0
    keyframe_id: Optional[int] = None
    keyframe_path: Optional[str] = None
    visual_similarity: float = 0.0
    agreement: bool = False
    explanation: str


class UnifiedSearchResult(BaseModel):
    """Ranked multimodal video moment search match"""
    media_id: int
    media_filename: str
    scene_id: Optional[int] = None
    scene_index: Optional[int] = None
    start_time: float
    end_time: float
    representative_timestamp: float
    thumbnail_path: Optional[str] = None
    score: float
    evidence: SearchMatchEvidence


class UnifiedSearchResponse(BaseModel):
    """Response payload for unified natural-language search"""
    query: str
    mode: str
    total_results: int
    latency_ms: float
    transcript_latency_ms: float
    visual_latency_ms: float
    fusion_latency_ms: float
    results: List[UnifiedSearchResult]
