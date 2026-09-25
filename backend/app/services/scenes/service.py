"""Scene detection service orchestrating detection, thumbnail extraction, and DB storage"""

import logging
from pathlib import Path
from typing import List, Optional

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.media import MediaAsset
from app.models.scene import Scene
from app.services.media.processor import FFmpegProcessor
from app.services.scenes.base import DetectedScene, SceneDetectorProvider
from app.services.scenes.detector import PySceneDetectProvider

logger = logging.getLogger(__name__)
settings = get_settings()


class SceneService:
    """Service for managing video scene boundaries and representative thumbnails"""

    def __init__(self, detector: Optional[SceneDetectorProvider] = None):
        self.detector = detector or PySceneDetectProvider()

    def process_media_scenes(
        self,
        media_id: int,
        db: Session,
        video_path: Optional[Path] = None,
        min_scene_len_sec: Optional[float] = None,
        frame_skip: Optional[int] = None,
    ) -> List[Scene]:
        """
        Detect scenes for a media asset, generate representative thumbnails, and persist to database.

        Args:
            media_id: Media asset ID
            db: SQLAlchemy Session
            video_path: Optional explicit video file path (prefers proxy_path for speed)
            min_scene_len_sec: Minimum scene length in seconds
            frame_skip: Frames to skip during analysis

        Returns:
            List of saved Scene database models
        """
        media_asset = db.query(MediaAsset).filter(MediaAsset.id == media_id).first()
        if not media_asset:
            logger.error(f"Media asset {media_id} not found for scene detection")
            return []

        # Determine best video path to analyze (prefer proxy for speed, fallback to original)
        file_to_analyze = video_path or (
            Path(media_asset.proxy_path) if media_asset.proxy_path and Path(media_asset.proxy_path).exists()
            else Path(media_asset.file_path) if media_asset.file_path and Path(media_asset.file_path).exists()
            else None
        )

        if not file_to_analyze or not file_to_analyze.exists():
            logger.error(f"No video file available for scene detection on media_id {media_id}")
            return []

        # Directory for scene thumbnails: storage/scenes/{media_id}/
        storage_base = Path(settings.media_storage_path)
        scene_thumb_dir = storage_base / "scenes" / str(media_id)
        scene_thumb_dir.mkdir(parents=True, exist_ok=True)

        min_len = min_scene_len_sec if min_scene_len_sec is not None else settings.scene_min_duration_seconds
        skip_count = frame_skip if frame_skip is not None else settings.scene_frame_skip

        try:
            detected_scenes: List[DetectedScene] = self.detector.detect_scenes(
                video_path=file_to_analyze,
                min_scene_len_sec=min_len,
                frame_skip=skip_count,
            )

            # Clear any previously saved scenes for this asset
            db.query(Scene).filter(Scene.media_id == media_id).delete()

            saved_scenes: List[Scene] = []

            for scene_data in detected_scenes:
                # Pick midpoint or start of scene as representative thumbnail frame
                if scene_data.duration > 0:
                    thumb_time = round(scene_data.start_time + (scene_data.duration * 0.5), 3)
                else:
                    thumb_time = scene_data.start_time

                # Cap thumbnail timestamp within media duration if known
                if media_asset.duration and thumb_time > media_asset.duration:
                    thumb_time = max(0.0, media_asset.duration - 0.1)

                thumb_filename = f"scene_{scene_data.scene_index:03d}_{thumb_time:.2f}s.jpg"
                thumb_path = scene_thumb_dir / thumb_filename

                # Extract scene thumbnail using FFmpeg
                try:
                    FFmpegProcessor.extract_thumbnail(
                        source_path=file_to_analyze,
                        thumbnail_path=thumb_path,
                        timestamp=thumb_time,
                    )
                    saved_thumb_str = str(thumb_path)
                except Exception as thumb_err:
                    logger.warning(f"Failed to generate thumbnail for scene {scene_data.scene_index}: {thumb_err}")
                    saved_thumb_str = None


                db_scene = Scene(
                    media_id=media_id,
                    scene_index=scene_data.scene_index,
                    start_time=scene_data.start_time,
                    end_time=scene_data.end_time,
                    duration=scene_data.duration,
                    thumbnail_path=saved_thumb_str,
                    thumbnail_time=thumb_time,
                    detector=getattr(self.detector, "detector_type", "pyscenedetect"),
                )
                db.add(db_scene)
                saved_scenes.append(db_scene)

            db.commit()
            for s in saved_scenes:
                db.refresh(s)

            logger.info(f"Successfully processed and saved {len(saved_scenes)} scenes for media {media_id}")
            return saved_scenes

        except Exception as e:
            logger.exception(f"Scene detection failed for media {media_id}: {e}")
            db.rollback()
            return []
