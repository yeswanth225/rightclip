"""Tests for Scene detection models, provider, service, and API endpoints"""

from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal, Base, engine
from app.models.media import MediaAsset, MediaStatus
from app.models.scene import Scene
from app.services.scenes.base import DetectedScene, SceneDetectorProvider
from app.services.scenes.service import SceneService

client = TestClient(app)


class MockSceneDetector(SceneDetectorProvider):
    """Mock scene detector for testing pipeline and service logic"""

    def __init__(self, should_fail: bool = False, num_scenes: int = 3):
        self.should_fail = should_fail
        self.num_scenes = num_scenes
        self.detector_type = "mock-detector"

    def detect_scenes(
        self,
        video_path: Path,
        min_scene_len_sec: float = 1.0,
        frame_skip: int = 2,
    ):
        if self.should_fail:
            raise RuntimeError("Simulated scene detector crash")

        if self.num_scenes == 0:
            return [
                DetectedScene(
                    scene_index=0,
                    start_time=0.0,
                    end_time=6.0,
                    duration=6.0,
                )
            ]

        return [
            DetectedScene(
                scene_index=0,
                start_time=0.0,
                end_time=2.0,
                duration=2.0,
            ),
            DetectedScene(
                scene_index=1,
                start_time=2.0,
                end_time=4.5,
                duration=2.5,
            ),
            DetectedScene(
                scene_index=2,
                start_time=4.5,
                end_time=6.0,
                duration=1.5,
            ),
        ]


def setup_function():
    Base.metadata.create_all(bind=engine)


def test_scene_service_mock_flow(tmp_path):
    """Test SceneService detection and DB persistence"""
    db = SessionLocal()
    try:
        dummy_video = tmp_path / "scene_test.mp4"
        dummy_video.write_bytes(b"dummy video data")

        asset = MediaAsset(
            filename="scene_test.mp4",
            source_type="upload",
            status=MediaStatus.PROCESSING,
            file_path=str(dummy_video),
            duration=6.0,
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)

        provider = MockSceneDetector(num_scenes=3)
        service = SceneService(detector=provider)

        scenes = service.process_media_scenes(
            media_id=asset.id,
            db=db,
            video_path=dummy_video,
        )

        assert len(scenes) == 3
        assert scenes[0].start_time == 0.0
        assert scenes[0].end_time == 2.0
        assert scenes[1].start_time == 2.0
        assert scenes[1].end_time == 4.5
        assert scenes[2].start_time == 4.5
        assert scenes[2].end_time == 6.0
        assert scenes[0].scene_index == 0
        assert scenes[1].scene_index == 1
        assert scenes[2].scene_index == 2

    finally:
        db.close()


def test_scene_service_graceful_failure(tmp_path):
    """Test SceneService handling exceptions gracefully"""
    db = SessionLocal()
    try:
        dummy_video = tmp_path / "scene_fail.mp4"
        dummy_video.write_bytes(b"dummy video data")

        asset = MediaAsset(
            filename="scene_fail.mp4",
            source_type="upload",
            status=MediaStatus.PROCESSING,
            file_path=str(dummy_video),
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)

        provider = MockSceneDetector(should_fail=True)
        service = SceneService(detector=provider)

        scenes = service.process_media_scenes(
            media_id=asset.id,
            db=db,
            video_path=dummy_video,
        )

        assert scenes == []

    finally:
        db.close()


def test_scene_api_endpoints():
    """Test GET /api/media/{id}/scenes and single scene endpoint"""
    db = SessionLocal()
    try:
        asset = MediaAsset(
            filename="scene_api_test.mp4",
            source_type="upload",
            status=MediaStatus.READY,
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)

        s0 = Scene(
            media_id=asset.id,
            scene_index=0,
            start_time=0.0,
            end_time=3.0,
            duration=3.0,
            thumbnail_time=1.5,
            detector="pyscenedetect",
        )
        s1 = Scene(
            media_id=asset.id,
            scene_index=1,
            start_time=3.0,
            end_time=7.0,
            duration=4.0,
            thumbnail_time=5.0,
            detector="pyscenedetect",
        )
        db.add_all([s0, s1])
        db.commit()

        # 1. Get all scenes
        res = client.get(f"/api/media/{asset.id}/scenes")
        assert res.status_code == 200
        data = res.json()
        assert data["media_id"] == asset.id
        assert data["total_scenes"] == 2
        assert len(data["scenes"]) == 2
        assert data["scenes"][0]["scene_index"] == 0
        assert data["scenes"][1]["start_time"] == 3.0

        # 2. Filter scenes by time range
        res_filter = client.get(f"/api/media/{asset.id}/scenes?start_time=4.0")
        assert res_filter.status_code == 200
        filter_data = res_filter.json()
        assert filter_data["total_scenes"] == 1
        assert filter_data["scenes"][0]["scene_index"] == 1

        # 3. Get single scene by index
        res_single = client.get(f"/api/media/{asset.id}/scenes/1")
        assert res_single.status_code == 200
        assert res_single.json()["scene_index"] == 1

        # 4. 404 for non-existent scene index
        res_404_scene = client.get(f"/api/media/{asset.id}/scenes/99")
        assert res_404_scene.status_code == 404

        # 5. 404 for non-existent media
        res_404_media = client.get("/api/media/99999/scenes")
        assert res_404_media.status_code == 404

    finally:
        db.close()
