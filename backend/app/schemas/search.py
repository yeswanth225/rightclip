"""Unified Search Schemas"""

from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class SearchMode(str, Enum):
    """Supported search retrieval modes"""
    HYBRID = "hybrid"          # Everything (Multimodal Fusion)
    ACTION = "action"          # Temporal action/event matching
    DIALOGUE = "dialogue"      # Exact & semantic transcript retrieval
    TRANSCRIPT = "transcript"  # Dialogue alias
    VISUAL = "visual"          # Visual similarity
    PERSON = "person"          # Reference face/person matching


class SearchMatchEvidence(BaseModel):
    """Detailed evidence from individual retrieval providers"""
    transcript_text: Optional[str] = None
    transcript_segment_id: Optional[int] = None
    transcript_score: float = 0.0
    keyframe_id: Optional[int] = None
    keyframe_path: Optional[str] = None
    visual_similarity: float = 0.0
    person_score: float = 0.0
    action_score: float = 0.0
    agreement: bool = False
    match_types: List[str] = Field(default_factory=list)  # ["visual", "action", "dialogue", "person"]
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
    transcript_latency_ms: float = 0.0
    visual_latency_ms: float = 0.0
    person_latency_ms: float = 0.0
    fusion_latency_ms: float = 0.0
    results: List[UnifiedSearchResult]


class MultimodalSearchRequest(BaseModel):
    """Payload for POST /api/search with optional reference image and mode"""
    query: Optional[str] = None
    reference_image_base64: Optional[str] = None
    media_id: Optional[int] = None
    mode: SearchMode = SearchMode.HYBRID
    limit: Optional[int] = None
