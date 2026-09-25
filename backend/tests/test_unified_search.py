"""Tests for Unified Multimodal Search and Ranking (Phase 6)"""

import pytest
from pathlib import Path
from typing import Dict, List
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal, Base, engine
from app.models.media import MediaAsset, MediaStatus
from app.models.scene import Scene
from app.models.transcript import Transcript, TranscriptSegment, TranscriptStatus
from app.models.visual import Keyframe
from app.schemas.search import SearchMode
from app.services.embeddings.clip_provider import VisualEmbeddingProvider
from app.services.vector.chroma_provider import VectorIndexProvider
from app.services.indexing.visual_service import VisualIndexingService
from app.services.search.unified_service import UnifiedSearchService

client = TestClient(app)


class MockVisualEmbeddingProvider(VisualEmbeddingProvider):
    """Mock visual embedding provider for unit test search ranking"""
    def embed_image(self, image_path: Path) -> List[float]:
        vec = [0.1] * 512
        norm = sum(x**2 for x in vec) ** 0.5
        return [x / norm for x in vec]

    def embed_images_batch(self, image_paths: List[Path], batch_size: int = None) -> List[List[float]]:
        return [self.embed_image(p) for p in image_paths]

    def embed_text(self, text: str) -> List[float]:
        val = 0.8 if "blue" in text.lower() else 0.2
        vec = [val] * 512
        norm = sum(x**2 for x in vec) ** 0.5
        return [x / norm for x in vec]


class MockVectorIndexProvider(VectorIndexProvider):
    def __init__(self):
        self.vectors: Dict[str, Dict] = {}

    def upsert_vectors(self, ids: List[str], embeddings: List[List[float]], metadatas: List[Dict], documents: List[str] = None):
        for vid, emb, meta in zip(ids, embeddings, metadatas):
            self.vectors[vid] = {"embedding": emb, "metadata": meta}

    def query_similarity(self, query_vector: List[float], top_k: int = 10, filter_criteria: Dict = None) -> List[Dict]:
        results = []
        for vid, item in self.vectors.items():
            meta = item["metadata"]
            if filter_criteria:
                match = all(meta.get(k) == v for k, v in filter_criteria.items())
                if not match:
                    continue
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


def test_transcript_search_retrieval():
    """Test tokenization, phrase scoring, and keyword retrieval in transcripts"""
    db = SessionLocal()
    try:
        asset = MediaAsset(
            filename="search_transcript_test.mp4",
            source_type="upload",
            status=MediaStatus.READY,
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)

        transcript = Transcript(
            media_id=asset.id,
            status=TranscriptStatus.COMPLETED,
            full_text="Today we discuss quantum computing algorithms and quantum circuits.",
        )
        db.add(transcript)
        db.commit()
        db.refresh(transcript)

        seg1 = TranscriptSegment(
            transcript_id=transcript.id,
            media_id=asset.id,
            segment_index=0,
            start_time=10.0,
            end_time=15.0,
            text="Today we discuss quantum computing algorithms",
        )
        seg2 = TranscriptSegment(
            transcript_id=transcript.id,
            media_id=asset.id,
            segment_index=1,
            start_time=16.0,
            end_time=22.0,
            text="and quantum circuits in detail.",
        )
        seg3 = TranscriptSegment(
            transcript_id=transcript.id,
            media_id=asset.id,
            segment_index=2,
            start_time=30.0,
            end_time=35.0,
            text="Unrelated cooking recipe segment.",
        )
        db.add_all([seg1, seg2, seg3])
        db.commit()

        service = UnifiedSearchService()
        matches = service.search_transcripts("quantum computing", db=db, media_id=asset.id)

        assert len(matches) >= 1
        assert matches[0]["segment_id"] == seg1.id
        assert matches[0]["score"] > 0.7

        # Unrelated query
        unrelated = service.search_transcripts("astronomy telescope", db=db, media_id=asset.id)
        assert len(unrelated) == 0

    finally:
        db.close()


def test_unified_multimodal_temporal_fusion():
    """Test fusing nearby transcript + visual matches into unified candidate with agreement bonus"""
    db = SessionLocal()
    try:
        asset = MediaAsset(
            filename="fusion_test.mp4",
            source_type="upload",
            status=MediaStatus.READY,
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)

        # Scene 1: 40s to 50s
        scene = Scene(
            media_id=asset.id,
            scene_index=1,
            start_time=40.0,
            end_time=50.0,
            duration=10.0,
        )
        db.add(scene)
        db.commit()
        db.refresh(scene)

        # Transcript in Scene 1 @ 42.0s -> 46.0s
        tr = Transcript(media_id=asset.id, status=TranscriptStatus.COMPLETED)
        db.add(tr)
        db.commit()
        db.refresh(tr)

        seg = TranscriptSegment(
            transcript_id=tr.id,
            media_id=asset.id,
            segment_index=0,
            start_time=42.0,
            end_time=46.0,
            text="We are explaining quantum computing architecture",
        )
        db.add(seg)
        db.commit()

        # Keyframe in Scene 1 @ 44.0s
        kf = Keyframe(
            media_id=asset.id,
            scene_id=scene.id,
            timestamp=44.0,
            frame_index=0,
            file_path="media/keyframes/test_kf.jpg",
            vector_id="kf_fusion_1",
        )
        db.add(kf)
        db.commit()
        db.refresh(kf)

        vec_mock = MockVectorIndexProvider()
        emb_mock = MockVisualEmbeddingProvider()

        # Add mock vector for kf with high blue similarity
        vec_mock.upsert_vectors(
            ids=["kf_fusion_1"],
            embeddings=[[0.8 / (512**0.5)] * 512],
            metadatas=[{
                "keyframe_id": kf.id,
                "media_id": asset.id,
                "scene_id": scene.id,
                "scene_index": scene.scene_index,
                "timestamp": 44.0,
                "frame_index": 0,
                "file_path": kf.file_path,
            }],
        )

        vis_service = VisualIndexingService(embedding_provider=emb_mock, vector_provider=vec_mock)
        search_service = UnifiedSearchService(visual_service=vis_service)

        # Query: quantum computing blue screen
        response = search_service.unified_search(
            query="quantum computing blue screen",
            db=db,
            media_id=asset.id,
            mode=SearchMode.HYBRID,
        )

        assert response.total_results >= 1
        top = response.results[0]
        assert top.media_id == asset.id
        assert top.scene_id == scene.id
        assert top.evidence.agreement is True
        assert top.evidence.transcript_segment_id == seg.id
        assert top.evidence.keyframe_id == kf.id
        # Start and end cover the temporal interval (42.0 to 46.0s envelope)
        assert top.start_time <= 42.0
        assert top.end_time >= 46.0

    finally:
        db.close()


def test_unified_search_api_endpoints():
    """Test GET /api/search endpoint with validation, modes, and filtering"""
    # 1. Empty query should return 400
    res_empty = client.get("/api/search", params={"q": "   "})
    assert res_empty.status_code == 400

    # 2. Non-existent media filter should return 404
    res_404 = client.get("/api/search", params={"q": "anything", "media_id": 999999})
    assert res_404.status_code == 404

    # 3. Valid search query
    res_valid = client.get("/api/search", params={"q": "test query", "mode": "hybrid", "limit": 5})
    assert res_valid.status_code == 200
    data = res_valid.json()
    assert "query" in data
    assert "mode" in data
    assert "total_results" in data
    assert "latency_ms" in data
    assert isinstance(data["results"], list)
