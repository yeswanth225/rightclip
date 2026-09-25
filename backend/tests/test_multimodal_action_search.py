import io
import base64
import pytest
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal, Base, engine
from app.models.media import MediaAsset, MediaStatus
from app.models.transcript import Transcript, TranscriptSegment, TranscriptStatus
from app.schemas.search import SearchMode
from app.services.search.unified_service import UnifiedSearchService

client = TestClient(app)


def setup_function():
    Base.metadata.create_all(bind=engine)


def test_action_and_dialogue_search():
    """Test action, dialogue, and multimodal fusion queries"""
    db = SessionLocal()
    try:
        # 1. Create Media Asset
        media = MediaAsset(
            filename="action_test_video.mp4",
            source_type="upload",
            status=MediaStatus.READY,
            duration=30.0,
            width=1280,
            height=720,
        )
        db.add(media)
        db.commit()
        db.refresh(media)

        # 2. Add transcript with spoken dialogue
        transcript = Transcript(
            media_id=media.id,
            status=TranscriptStatus.COMPLETED,
            provider="faster-whisper",
            model_name="base",
            full_text="We need to leave now. The character explains what happened about the missing money.",
        )
        db.add(transcript)
        db.commit()
        db.refresh(transcript)

        seg1 = TranscriptSegment(
            transcript_id=transcript.id,
            media_id=media.id,
            segment_index=0,
            start_time=5.0,
            end_time=9.5,
            text="We need to leave now.",
        )
        seg2 = TranscriptSegment(
            transcript_id=transcript.id,
            media_id=media.id,
            segment_index=1,
            start_time=12.0,
            end_time=18.0,
            text="The character explains what happened about the missing money.",
        )
        db.add_all([seg1, seg2])
        db.commit()

        # 3. Test exact & semantic dialogue search
        search_service = UnifiedSearchService()
        resp_dialogue = search_service.unified_search(
            query="we need to leave now",
            db=db,
            media_id=media.id,
            mode=SearchMode.DIALOGUE,
        )
        assert resp_dialogue.total_results > 0
        assert "leave now" in resp_dialogue.results[0].evidence.transcript_text.lower()
        assert "dialogue" in resp_dialogue.results[0].evidence.match_types

        # 4. Test action query
        resp_action = search_service.unified_search(
            query="The character opens the car door and gets inside",
            db=db,
            media_id=media.id,
            mode=SearchMode.ACTION,
        )
        assert resp_action.mode == "action"
    finally:
        db.close()


def test_person_reference_and_image_search():
    """Test person reference image and multimodal image+text retrieval"""
    db = SessionLocal()
    try:
        media = MediaAsset(
            filename="person_test_video.mp4",
            source_type="upload",
            status=MediaStatus.READY,
            duration=20.0,
        )
        db.add(media)
        db.commit()
        db.refresh(media)

        # Generate small dummy reference image
        img = Image.new("RGB", (64, 64), color=(120, 80, 200))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        b64_img = base64.b64encode(buf.getvalue()).decode("utf-8")

        # POST API test with image reference
        resp = client.post(
            "/api/search",
            json={
                "query": "when this person enters the room",
                "reference_image_base64": b64_img,
                "media_id": media.id,
                "mode": "hybrid",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "query" in data
        assert data["mode"] == "hybrid"
    finally:
        db.close()


def test_missing_indexes_graceful_handling():
    """Verify system handles missing transcript or missing vectors cleanly without error"""
    db = SessionLocal()
    try:
        media = MediaAsset(
            filename="empty_indexes.mp4",
            source_type="upload",
            status=MediaStatus.READY,
            duration=10.0,
        )
        db.add(media)
        db.commit()
        db.refresh(media)

        search_service = UnifiedSearchService()
        # Query non-existent content
        resp = search_service.unified_search(
            query="completely absent query content xyz123",
            db=db,
            media_id=media.id,
            mode=SearchMode.HYBRID,
        )
        assert resp.total_results == 0
        assert resp.results == []
    finally:
        db.close()
