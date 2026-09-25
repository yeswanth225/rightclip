"""Tests for transcription models, service, and API endpoints"""

import io
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal, Base, engine
from app.models.media import MediaAsset, MediaStatus
from app.models.transcript import Transcript, TranscriptSegment, TranscriptStatus
from app.services.transcription.base import SegmentResult, TranscriptionProvider, TranscriptionResult
from app.services.transcription.service import TranscriptionService

client = TestClient(app)


class MockTranscriptionProvider(TranscriptionProvider):
    """Mock provider for unit testing without downloading full whisper weights"""

    def __init__(self, should_fail: bool = False):
        self.should_fail = should_fail
        self.provider_name = "mock-whisper"
        self.model_size = "mock-tiny"

    def transcribe(self, audio_or_video_path: Path, language: str = None) -> TranscriptionResult:
        if self.should_fail:
            raise RuntimeError("Simulated transcription engine failure")

        return TranscriptionResult(
            language="en",
            language_probability=0.98,
            duration=4.5,
            full_text="Welcome to ClipFinder video search demonstration.",
            segments=[
                SegmentResult(
                    segment_index=0,
                    start_time=0.0,
                    end_time=2.2,
                    text="Welcome to ClipFinder",
                    avg_logprob=-0.2,
                    no_speech_prob=0.01,
                ),
                SegmentResult(
                    segment_index=1,
                    start_time=2.2,
                    end_time=4.5,
                    text="video search demonstration.",
                    avg_logprob=-0.15,
                    no_speech_prob=0.01,
                ),
            ],
            provider="mock-whisper",
            model_name="mock-tiny",
        )


def setup_function():
    Base.metadata.create_all(bind=engine)


def test_transcription_service_mock_flow(tmp_path):
    """Test full service orchestration from file to DB persistence"""
    db = SessionLocal()
    try:
        # Create a test video dummy file
        dummy_video = tmp_path / "test.mp4"
        dummy_video.write_bytes(b"dummy video data")

        # Create media asset in DB
        asset = MediaAsset(
            filename="test.mp4",
            source_type="upload",
            status=MediaStatus.PROCESSING,
            file_path=str(dummy_video),
            audio_codec="aac",
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)

        # Run transcription with mock provider
        provider = MockTranscriptionProvider(should_fail=False)
        service = TranscriptionService(provider=provider)
        transcript = service.process_media_transcription(
            media_id=asset.id,
            db=db,
            media_path=dummy_video,
        )

        assert transcript is not None
        assert transcript.status == TranscriptStatus.COMPLETED
        assert transcript.language == "en"
        assert len(transcript.segments) == 2
        assert transcript.segments[0].text == "Welcome to ClipFinder"
        assert transcript.segments[1].start_time == 2.2

    finally:
        db.close()


def test_transcription_service_failure_handling(tmp_path):
    """Test failure recording in DB when provider errors"""
    db = SessionLocal()
    try:
        dummy_video = tmp_path / "test_err.mp4"
        dummy_video.write_bytes(b"dummy video data")

        asset = MediaAsset(
            filename="test_err.mp4",
            source_type="upload",
            status=MediaStatus.PROCESSING,
            file_path=str(dummy_video),
            audio_codec="aac",
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)

        provider = MockTranscriptionProvider(should_fail=True)
        service = TranscriptionService(provider=provider)
        transcript = service.process_media_transcription(
            media_id=asset.id,
            db=db,
            media_path=dummy_video,
        )

        assert transcript is not None
        assert transcript.status == TranscriptStatus.FAILED
        assert "Simulated transcription engine failure" in transcript.error_message

    finally:
        db.close()


def test_transcript_api_endpoints():
    """Test GET /api/media/{id}/transcript and /segments endpoints"""
    db = SessionLocal()
    try:
        asset = MediaAsset(
            filename="api_test.mp4",
            source_type="upload",
            status=MediaStatus.READY,
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)

        transcript = Transcript(
            media_id=asset.id,
            status=TranscriptStatus.COMPLETED,
            language="en",
            duration=5.0,
            full_text="Test API transcript text",
            provider="mock-whisper",
            model_name="mock-base",
        )
        db.add(transcript)
        db.commit()
        db.refresh(transcript)

        seg1 = TranscriptSegment(
            transcript_id=transcript.id,
            media_id=asset.id,
            segment_index=0,
            start_time=0.0,
            end_time=2.5,
            text="Test API",
        )
        seg2 = TranscriptSegment(
            transcript_id=transcript.id,
            media_id=asset.id,
            segment_index=1,
            start_time=2.5,
            end_time=5.0,
            text="transcript text",
        )
        db.add_all([seg1, seg2])
        db.commit()

        # 1. Test get transcript
        res = client.get(f"/api/media/{asset.id}/transcript")
        assert res.status_code == 200
        data = res.json()
        assert data["media_id"] == asset.id
        assert data["status"] == "completed"
        assert len(data["segments"]) == 2

        # 2. Test get segments with time filter
        res_seg = client.get(f"/api/media/{asset.id}/transcript/segments?start_time=2.0")
        assert res_seg.status_code == 200
        seg_data = res_seg.json()
        assert len(seg_data) == 2  # seg1 ends at 2.5 >= 2.0 and seg2 starts at 2.5

        # 3. Test 404 for non-existent media
        res_404 = client.get("/api/media/999999/transcript")
        assert res_404.status_code == 404

    finally:
        db.close()
