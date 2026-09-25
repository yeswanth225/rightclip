"""Visual indexing service coordinating keyframe extraction, embedding generation, and vector indexing"""

import logging
import uuid
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.media import MediaAsset
from app.models.scene import Scene
from app.models.visual import Keyframe
from app.services.embeddings.clip_provider import OpenCLIPProvider, VisualEmbeddingProvider
from app.services.media.processor import FFmpegProcessor
from app.services.vector.chroma_provider import ChromaVectorProvider, VectorIndexProvider

logger = logging.getLogger(__name__)
settings = get_settings()


class VisualIndexingService:
    """Service for extracting scene keyframes, computing visual embeddings, and syncing vector database"""

    def __init__(
        self,
        embedding_provider: Optional[VisualEmbeddingProvider] = None,
        vector_provider: Optional[VectorIndexProvider] = None,
    ):
        self.embedding_provider = embedding_provider or OpenCLIPProvider()
        self.vector_provider = vector_provider or ChromaVectorProvider()

    @staticmethod
    def calculate_scene_keyframe_timestamps(
        start_time: float,
        end_time: float,
        duration: float,
    ) -> List[float]:
        """
        Calculate adaptive keyframe timestamps within a scene.
        
        Rules:
        - duration < 3.0s: 1 keyframe at midpoint (50%)
        - 3.0s <= duration <= 10.0s: 2 keyframes (25%, 75%)
        - duration > 10.0s: 3 keyframes (15%, 50%, 85%)
        """
        if duration <= 0:
            return [start_time]

        if duration < 3.0:
            return [round(start_time + (duration * 0.5), 3)]
        elif duration <= 10.0:
            return [
                round(start_time + (duration * 0.25), 3),
                round(start_time + (duration * 0.75), 3),
            ]
        else:
            return [
                round(start_time + (duration * 0.15), 3),
                round(start_time + (duration * 0.50), 3),
                round(start_time + (duration * 0.85), 3),
            ]

    def index_media_visuals(
        self,
        media_id: int,
        db: Session,
        video_path: Optional[Path] = None,
    ) -> List[Keyframe]:
        """
        Extract adaptive keyframes across all scenes of a media asset, embed them, and index in ChromaDB.

        Args:
            media_id: Media asset identifier
            db: SQLAlchemy session
            video_path: Optional video file path (prefers proxy for speed)

        Returns:
            List of created Keyframe models
        """
        media_asset = db.query(MediaAsset).filter(MediaAsset.id == media_id).first()
        if not media_asset:
            logger.error(f"Media asset {media_id} not found for visual indexing")
            return []

        scenes = (
            db.query(Scene)
            .filter(Scene.media_id == media_id)
            .order_by(Scene.start_time)
            .all()
        )
        if not scenes:
            logger.warning(f"No scenes found for media {media_id}. Cannot extract keyframes.")
            return []

        file_to_extract = video_path or (
            Path(media_asset.proxy_path) if media_asset.proxy_path and Path(media_asset.proxy_path).exists()
            else Path(media_asset.file_path) if media_asset.file_path and Path(media_asset.file_path).exists()
            else None
        )

        if not file_to_extract or not file_to_extract.exists():
            logger.error(f"No video file accessible for keyframe extraction on media {media_id}")
            return []

        # 1. Clean up existing vector entries and keyframe DB rows for idempotent re-runs
        self.vector_provider.delete_by_media_id(media_id)
        db.query(Keyframe).filter(Keyframe.media_id == media_id).delete()
        db.commit()

        # Keyframe storage directory: storage/keyframes/{media_id}/
        storage_base = Path(settings.media_storage_path)
        keyframe_dir = storage_base / "keyframes" / str(media_id)
        keyframe_dir.mkdir(parents=True, exist_ok=True)

        extracted_keyframes: List[Tuple[Scene, int, float, Path]] = []

        # 2. Extract keyframes from proxy video via FFmpeg
        for scene in scenes:
            timestamps = self.calculate_scene_keyframe_timestamps(
                start_time=scene.start_time,
                end_time=scene.end_time,
                duration=scene.duration,
            )

            for f_idx, t_stamp in enumerate(timestamps):
                # Clamp within media bounds
                if media_asset.duration and t_stamp > media_asset.duration:
                    t_stamp = max(0.0, media_asset.duration - 0.05)

                kf_filename = f"scene_{scene.scene_index:03d}_kf_{f_idx}_{t_stamp:.2f}s.jpg"
                kf_path = keyframe_dir / kf_filename

                try:
                    FFmpegProcessor.extract_thumbnail(
                        source_path=file_to_extract,
                        thumbnail_path=kf_path,
                        timestamp=t_stamp,
                    )
                    extracted_keyframes.append((scene, f_idx, t_stamp, kf_path))
                except Exception as kf_err:
                    logger.warning(f"Failed to extract keyframe at {t_stamp}s: {kf_err}")

        if not extracted_keyframes:
            logger.warning(f"No keyframes successfully extracted for media {media_id}")
            return []

        # 3. Compute OpenCLIP embeddings in batch
        image_paths = [item[3] for item in extracted_keyframes]
        logger.info(f"Computing CLIP embeddings for {len(image_paths)} keyframes...")
        embeddings = self.embedding_provider.embed_images_batch(image_paths)

        # 4. Prepare database models, flush to assign primary keys, then build Chroma metadatas
        vector_ids = []
        keyframe_records: List[Keyframe] = []

        for (scene, f_idx, t_stamp, kf_path) in extracted_keyframes:
            vid = f"kf_{media_id}_{scene.id}_{f_idx}_{uuid.uuid4().hex[:8]}"
            vector_ids.append(vid)

            db_kf = Keyframe(
                media_id=media_id,
                scene_id=scene.id,
                timestamp=t_stamp,
                frame_index=f_idx,
                file_path=str(kf_path),
                vector_id=vid,
            )
            db.add(db_kf)
            keyframe_records.append(db_kf)

        # Flush session to assign auto-incrementing primary key IDs
        db.flush()

        # 5. Build vector metadatas with real keyframe_id
        metadatas = []
        for (scene, f_idx, t_stamp, kf_path), db_kf in zip(extracted_keyframes, keyframe_records):
            metadatas.append({
                "keyframe_id": db_kf.id,
                "media_id": media_id,
                "scene_id": scene.id,
                "scene_index": scene.scene_index,
                "timestamp": t_stamp,
                "frame_index": f_idx,
                "file_path": str(kf_path),
            })

        # 6. Upsert to Vector Database
        self.vector_provider.upsert_vectors(
            ids=vector_ids,
            embeddings=embeddings,
            metadatas=metadatas,
        )

        db.commit()
        for k in keyframe_records:
            db.refresh(k)

        logger.info(f"Successfully indexed {len(keyframe_records)} keyframes for media {media_id}")
        return keyframe_records

    def search_similar_keyframes(
        self,
        query_text: str,
        top_k: int = 10,
        media_id: Optional[int] = None,
    ) -> List[Dict]:
        """
        Search for most visually similar keyframes matching natural language prompt

        Args:
            query_text: Natural language prompt (e.g. 'hair flip', 'red background')
            top_k: Number of results
            media_id: Optional filter for specific media asset

        Returns:
            List of matching records with similarity score and metadata
        """
        query_vector = self.embedding_provider.embed_text(query_text)
        filter_criteria = {"media_id": media_id} if media_id is not None else None

        matches = self.vector_provider.query_similarity(
            query_vector=query_vector,
            top_k=top_k,
            filter_criteria=filter_criteria,
        )
        return matches
