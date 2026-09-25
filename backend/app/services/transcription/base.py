"""Transcription provider abstraction and data transfer objects"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional


@dataclass
class SegmentResult:
    """Individual transcription segment result"""
    segment_index: int
    start_time: float
    end_time: float
    text: str
    avg_logprob: Optional[float] = None
    no_speech_prob: Optional[float] = None


@dataclass
class TranscriptionResult:
    """Full transcription result"""
    language: Optional[str]
    language_probability: Optional[float]
    duration: Optional[float]
    full_text: str
    segments: List[SegmentResult] = field(default_factory=list)
    provider: str = "faster-whisper"
    model_name: str = "base"


class TranscriptionProvider(ABC):
    """Abstract base class for transcription providers"""

    @abstractmethod
    def transcribe(self, audio_or_video_path: Path, language: Optional[str] = None) -> TranscriptionResult:
        """
        Transcribe audio or video file

        Args:
            audio_or_video_path: Path to media file
            language: Optional language code (e.g. 'en')

        Returns:
            TranscriptionResult with segments and metadata
        """
        pass
