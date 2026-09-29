"""Unit tests for Phase 7 Clip model, schema validation, and API endpoints"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.models.media import MediaAsset, MediaStatus
from app.models.clip import Clip

client = TestClient(app)


def test_clip_crud_and_validation():
    db = SessionLocal()
    try:
        # 1. Create a media asset with 10.0s duration
        asset = MediaAsset(
            filename="clip_test_video.mp4",
            source_type="upload",
            status=MediaStatus.READY,
            duration=10.0,
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)

        # 2. Test Invalid range: start >= end (400 or 422)
        res_invalid_range = client.post(
            "/api/clips",
            json={
                "media_id": asset.id,
                "title": "Invalid Clip",
                "start_time": 5.0,
                "end_time": 4.0,
            },
        )
        assert res_invalid_range.status_code in (400, 422)

        # 3. Test Invalid range: negative start
        res_negative_start = client.post(
            "/api/clips",
            json={
                "media_id": asset.id,
                "title": "Negative Clip",
                "start_time": -1.0,
                "end_time": 4.0,
            },
        )
        assert res_negative_start.status_code in (400, 422)

        # 4. Test Invalid range: end > media duration
        res_exceeds = client.post(
            "/api/clips",
            json={
                "media_id": asset.id,
                "title": "Exceeds Clip",
                "start_time": 2.0,
                "end_time": 15.0,
            },
        )
        assert res_exceeds.status_code == 400

        # 5. Test Non-existent media (404)
        res_404 = client.post(
            "/api/clips",
            json={
                "media_id": 999999,
                "title": "Missing Media",
                "start_time": 1.0,
                "end_time": 3.0,
            },
        )
        assert res_404.status_code == 404

        # 6. Test Valid Clip Creation
        res_create = client.post(
            "/api/clips",
            json={
                "media_id": asset.id,
                "title": "Opening Scene Highlight",
                "start_time": 1.5,
                "end_time": 4.5,
                "search_query": "blue background",
                "evidence_json": {"visual_similarity": 0.88, "agreement": True},
            },
        )
        assert res_create.status_code == 201
        created_clip = res_create.json()
        assert created_clip["id"] > 0
        assert created_clip["duration"] == 3.0
        assert created_clip["search_query"] == "blue background"
        clip_id = created_clip["id"]

        # 7. Test Get Clip
        res_get = client.get(f"/api/clips/{clip_id}")
        assert res_get.status_code == 200
        assert res_get.json()["title"] == "Opening Scene Highlight"

        # 8. Test List Media Clips
        res_list = client.get(f"/api/media/{asset.id}/clips")
        assert res_list.status_code == 200
        data = res_list.json()
        assert data["total_clips"] == 1
        assert data["clips"][0]["id"] == clip_id

        # 9. Test Update Clip
        res_update = client.put(
            f"/api/clips/{clip_id}",
            json={
                "title": "Refined Highlight",
                "start_time": 1.0,
                "end_time": 5.0,
            },
        )
        assert res_update.status_code == 200
        updated = res_update.json()
        assert updated["title"] == "Refined Highlight"
        assert updated["start_time"] == 1.0
        assert updated["end_time"] == 5.0
        assert updated["duration"] == 4.0

        # 10. Test Export Endpoint with missing file
        res_export_missing = client.post(f"/api/clips/{clip_id}/export")
        # Should return 400 since media file_path is dummy
        assert res_export_missing.status_code == 400

        # 11. Test Export Moment Endpoint with invalid range
        res_export_moment_bad = client.post(f"/api/media/{asset.id}/export-clip?start_time=6.0&end_time=4.0")
        assert res_export_moment_bad.status_code == 400

        # 12. Test Delete Clip
        res_del = client.delete(f"/api/clips/{clip_id}")
        assert res_del.status_code == 204

        # 13. Verify Deletion
        res_get_deleted = client.get(f"/api/clips/{clip_id}")
        assert res_get_deleted.status_code == 404

    finally:
        # Cleanup
        db.query(Clip).filter(Clip.media_id == asset.id).delete()
        db.query(MediaAsset).filter(MediaAsset.id == asset.id).delete()
        db.commit()
        db.close()

