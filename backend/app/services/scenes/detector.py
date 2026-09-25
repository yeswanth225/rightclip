"""PySceneDetect implementation with ContentDetector and AdaptiveDetector options"""

import logging
from pathlib import Path
from typing import List, Optional

from app.core.config import get_settings
from app.services.scenes.base import DetectedScene, SceneDetectorProvider

logger = logging.getLogger(__name__)
settings = get_settings()


class PySceneDetectProvider(SceneDetectorProvider):
    """PySceneDetect wrapper with content change detection and frame-skipping optimizations"""

    def __init__(
        self,
        detector_type: Optional[str] = None,
        threshold: Optional[float] = None,
    ):
        self.detector_type = detector_type or settings.scene_detector_type
        self.threshold = threshold if threshold is not None else settings.scene_threshold

    def detect_scenes(
        self,
        video_path: Path,
        min_scene_len_sec: float = 1.0,
        frame_skip: int = 2,
    ) -> List[DetectedScene]:
        """
        Detect scene cuts using PySceneDetect

        Args:
            video_path: Path to video (recommended proxy video for speed)
            min_scene_len_sec: Minimum scene length in seconds
            frame_skip: Downsampling/frame skip rate to save CPU

        Returns:
            List of DetectedScene
        """
        from scenedetect import SceneManager, open_video
        from scenedetect.detectors import ContentDetector, AdaptiveDetector, ThresholdDetector

        path_str = str(video_path)
        if not Path(path_str).exists():
            raise FileNotFoundError(f"Video file not found for scene detection: {path_str}")

        logger.info(
            f"Running scene detection on {video_path.name} with detector='{self.detector_type}', "
            f"threshold={self.threshold}, frame_skip={frame_skip}"
        )

        video = open_video(path_str)
        fps = video.frame_rate
        total_frames = video.duration.get_frames() if video.duration else 0
        total_duration_sec = video.duration.get_seconds() if video.duration else 0.0

        min_scene_frames = max(1, int(fps * min_scene_len_sec))

        scene_manager = SceneManager()
        scene_manager.auto_downscale = True  # Automatically downscale resolution during analysis for speed

        # Configure detector
        if self.detector_type == "adaptive":
            scene_manager.add_detector(
                AdaptiveDetector(
                    adaptive_threshold=self.threshold,
                    min_scene_len=min_scene_frames,
                )
            )
        elif self.detector_type == "threshold":
            scene_manager.add_detector(
                ThresholdDetector(
                    threshold=self.threshold,
                    min_scene_len=min_scene_frames,
                )
            )
        else:
            # Default ContentDetector
            scene_manager.add_detector(
                ContentDetector(
                    threshold=self.threshold,
                    min_scene_len=min_scene_frames,
                )
            )

        # Detect scenes with frame skipping
        # frame_skip skips N frames per processed frame (e.g. 2 means 1 of every 3 frames is analyzed)
        scene_manager.detect_scenes(video=video, frame_skip=max(0, frame_skip))
        scene_list = scene_manager.get_scene_list()

        results: List[DetectedScene] = []

        # If no cuts were detected, treat the entire video as one single scene
        if not scene_list:
            logger.info(f"No scene cuts detected for {video_path.name}. Creating single scene for full duration.")
            if total_duration_sec <= 0 and total_frames > 0 and fps > 0:
                total_duration_sec = total_frames / fps
            results.append(
                DetectedScene(
                    scene_index=0,
                    start_time=0.0,
                    end_time=round(total_duration_sec, 3),
                    duration=round(total_duration_sec, 3),
                    start_frame=0,
                    end_frame=total_frames,
                )
            )
            return results

        for idx, (start_timecode, end_timecode) in enumerate(scene_list):
            start_sec = start_timecode.get_seconds()
            end_sec = end_timecode.get_seconds()
            duration_sec = end_sec - start_sec

            results.append(
                DetectedScene(
                    scene_index=idx,
                    start_time=round(start_sec, 3),
                    end_time=round(end_sec, 3),
                    duration=round(duration_sec, 3),
                    start_frame=start_timecode.get_frames(),
                    end_frame=end_timecode.get_frames(),
                )
            )

        logger.info(f"Detected {len(results)} scenes in {video_path.name}")
        return results
