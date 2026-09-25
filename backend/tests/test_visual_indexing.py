"""Tests for visual embedding, keyframe extraction, ChromaDB vector indexing, and visual search API"""

from pathlib import Path
from typing import Dict, List
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal, Base, engine
from app.models.media import MediaAsset, MediaStatus
from app.models.scene import Scene
from app.models.visual import Keyframe
from app.services.embeddings.clip_provider import VisualEmbeddingProvider
from app.services.vector.chroma_provider import VectorIndexProvider
from app.services.indexing.visual_service import VisualIndexingService

client = TestClient(app)


class MockVisualEmbeddingProvider(VisualEmbeddingProvider):
    """Mock visual embedding provider producing deterministic 512-dim vectors"""

    def embed_image(self, image_path: Path) -> List[float]:
        # Generate normalized 512-dim vector
        vec = [0.1] * 512
        norm = sum(x**2 for x in vec) ** 0.5
        return [x / norm for x in vec]

    def embed_images_batch(self, image_paths: List[Path], batch_size: int = None) -> List[List[float]]:
        return [self.embed_image(p) for p in image_paths]

    def embed_text(self, text: str) -> List[float]:
        # Give distinctive values based on keywords
        val = 0.5 if "red" in text.lower() else 0.1
        vec = [val] * 512
        norm = sum(x**2 for x in vec) ** 0.5
        return [x / norm for x in vec]


class MockVectorIndexProvider(VectorIndexProvider):
    """In-memory mock vector store for testing indexing and cleanup without disk side-effects"""

    def __init__(self):
        self.vectors: Dict[str, Dict] = {}

    def upsert_vectors(self, ids: List[str], embeddings: List[List[float]], metadatas: List[Dict], documents: List[str] = None):
        for vid, emb, meta in zip(ids, embeddings, metadatas):
            self.vectors[vid] = {
                "embedding": emb,
                "metadata": meta,
            }

    def query_similarity(self, query_vector: List[float], top_k: int = 10, filter_criteria: Dict = None) -> List[Dict]:
        results = []
        for vid, item in self.vectors.items():
            meta = item["metadata"]
            if filter_criteria:
                match = all(meta.get(k) == v for k, v in filter_criteria.items())
                if not match:
                    continue

            # Dot product for cosine similarity of unit vectors
            sim = sum(a * b for a, b in zip(query_vector, item["embedding"]))
            results.append({
                "id": vid,
                "similarity": sim,
                "metadata": meta,
            })

        results.sort(key=lambda x: x["similarity"], reverse=True)
        return results[:top_k]

    def delete_by_media_id(self, media_id: int):
        to_del = [vid for vid, item in self.vectors.items() if item["metadata"].get("media_id") == media_id]
        for vid in to_del:
            del self.vectors[vid]

    def delete_by_ids(self, ids: List[str]):
        for vid in ids:
            self.vectors.pop(vid, None)


def setup_function():
    Base.metadata.create_all(bind=engine)


def test_visual_indexing_service_flow(tmp_path, monkeypatch):
    """Test adaptive keyframing, embedding creation, and DB & vector persistence"""
    db = SessionLocal()
    try:
        dummy_video = tmp_path / "test_video.mp4"
        dummy_video.write_bytes(b"video data")

        asset = MediaAsset(
            filename="test_video.mp4",
            source_type="upload",
            status=MediaStatus.PROCESSING,
            file_path=str(dummy_video),
            duration=8.0,
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)

        # Add 2 scenes: one short (2s -> 1 kf), one medium (6s -> 2 kfs)
        s0 = Scene(media_id=asset.id, scene_index=0, start_time=0.0, end_time=2.0, duration=2.0)
        s1 = Scene(media_id=asset.id, scene_index=1, start_time=2.0, end_time=8.0, duration=6.0)
        db.add_all([s0, s1])
        db.commit()

        # Mock FFmpegProcessor.extract_thumbnail to write a dummy file
        def fake_extract_thumbnail(source_path, thumbnail_path, timestamp):
            Path(thumbnail_path).parent.mkdir(parents=True, exist_ok=True)
            Path(thumbnail_path).write_bytes(b"fake_jpeg")
            return str(thumbnail_path)

        from app.services.media.processor import FFmpegProcessor
        monkeypatch.setattr(FFmpegProcessor, "extract_thumbnail", fake_extract_thumbnail)

        emb_mock = MockVisualEmbeddingProvider()
        vec_mock = MockVectorIndexProvider()
        service = VisualIndexingService(embedding_provider=emb_mock, vector_provider=vec_mock)

        # Run indexing
        keyframes = service.index_media_visuals(
            media_id=asset.id,
            db=db,
            video_path=dummy_video,
        )

        assert len(keyframes) == 3
        assert len(vec_mock.vectors) == 3
        assert keyframes[0].scene_id == s0.id
        assert keyframes[0].timestamp == 1.0  # midpoint of 2s scene
        assert keyframes[1].scene_id == s1.id
        assert keyframes[1].timestamp == 3.5  # 25% of 6s scene + 2.0s
        assert keyframes[2].timestamp == 6.5  # 75% of 6s scene + 2.0s

        # Test duplicate prevention / idempotence on re-indexing
        keyframes_re = service.index_media_visuals(
            media_id=asset.id,
            db=db,
            video_path=dummy_video,
        )
        assert len(keyframes_re) == 3
        assert len(vec_mock.vectors) == 3  # Old vectors replaced, no duplicates

        # Test vector search
        search_hits = service.search_similar_keyframes("find scene", top_k=2, media_id=asset.id)
        assert len(search_hits) == 2
        assert search_hits[0]["metadata"]["media_id"] == asset.id

    finally:
        db.close()


def test_visual_endpoints_and_deletion_cleanup():
    """Test GET /api/media/{id}/keyframes and DELETE /api/media/{id} cleanup"""
    db = SessionLocal()
    try:
        asset = MediaAsset(
            filename="delete_test.mp4",
            source_type="upload",
            status=MediaStatus.READY,
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
        media_id = asset.id

        scene = Scene(media_id=media_id, scene_index=0, start_time=0.0, end_time=5.0, duration=5.0)
        db.add(scene)
        db.commit()
        db.refresh(scene)

        kf = Keyframe(
            media_id=media_id,
            scene_id=scene.id,
            timestamp=2.5,
            frame_index=0,
            file_path="media/keyframes/test.jpg",
            vector_id=f"kf_{media_id}_{scene.id}_0_test",
        )
        db.add(kf)
        db.commit()
        db.close()

        # 1. Fetch keyframes endpoint
        res = client.get(f"/api/media/{media_id}/keyframes")
        assert res.status_code == 200
        data = res.json()
        assert data["total_keyframes"] == 1
        assert data["keyframes"][0]["timestamp"] == 2.5

        # 2. Delete media asset
        del_res = client.delete(f"/api/media/{media_id}")
        assert del_res.status_code == 204

        # 3. Verify cascading delete of keyframes with fresh DB session
        check_db = SessionLocal()
        try:
            assert check_db.query(Keyframe).filter(Keyframe.media_id == media_id).count() == 0
            assert check_db.query(Scene).filter(Scene.media_id == media_id).count() == 0
            assert check_db.query(MediaAsset).filter(MediaAsset.id == media_id).first() is None
        finally:
            check_db.close()

    except Exception:
        db.close()
        raise
