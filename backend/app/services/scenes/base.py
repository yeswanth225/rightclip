"""Scene detection base classes, abstractions, and data models"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional


@dataclass
class DetectedScene:
    """Individual detected scene with frame/time boundaries"""
    scene_index: int
    start_time: float
    end_time: float
    duration: float
    start_frame: Optional[int] = None
    end_frame: Optional[int] = None
    thumbnail_path: Optional[str] = None
    thumbnail_time: Optional[float] = None
    score: Optional[float] = None


@dataclass
class SceneDetectionResult:
    """Complete scene detection result for a media asset"""
    total_scenes: int
    scenes: List[DetectedScene] = field(default_factory=list)
    detector: str = "pyscenedetect"


class SceneDetectorProvider(ABC):
    """Abstract provider for scene boundary detection algorithms"""

    @abstractmethod
    def detect_scenes(
        self,
        video_path: Path,
        min_scene_len_sec: float = 1.0,
        frame_skip: int = 2,
    ) -> List[DetectedScene]:
        """
        Detect scene boundaries in video

        Args:
            video_path: Path to video file (proxy or original)
            min_scene_len_sec: Minimum duration in seconds for a distinct scene
            frame_skip: Number of frames to skip to accelerate analysis

        Returns:
            List of DetectedScene items
        """
        pass
