"""Tests for long-video reliability, adaptive keyframing, and search hardening"""

import pytest
from app.services.indexing.visual_service import VisualIndexingService
from app.services.search.unified_service import UnifiedSearchService
from app.schemas.search import SearchMode, UnifiedSearchResult


def test_long_video_adaptive_keyframing():
    """Verify adaptive keyframing scales gracefully for short, medium, and 20-30+ minute video scenes"""
    # 1. Very short scene (2s) -> 1 midpoint keyframe
    kf_short = VisualIndexingService.calculate_scene_keyframe_timestamps(0.0, 2.0, 2.0)
    assert len(kf_short) == 1
    assert kf_short[0] == 1.0

    # 2. Medium scene (8s) -> 2 keyframes
    kf_med = VisualIndexingService.calculate_scene_keyframe_timestamps(10.0, 18.0, 8.0)
    assert len(kf_med) == 2
    assert kf_med[0] == 12.0
    assert kf_med[1] == 16.0

    # 3. Standard scene (20s) -> 3 keyframes
    kf_std = VisualIndexingService.calculate_scene_keyframe_timestamps(20.0, 40.0, 20.0)
    assert len(kf_std) == 3
    assert kf_std[0] == 23.0
    assert kf_std[1] == 30.0
    assert kf_std[2] == 37.0

    # 4. Long scene (120s / 2 minutes) in a long video -> regular sampled intervals
    kf_long = VisualIndexingService.calculate_scene_keyframe_timestamps(100.0, 220.0, 120.0)
    assert len(kf_long) > 3
    assert len(kf_long) <= 30
    assert kf_long[0] == 103.0
    # Keyframe timestamps must be monotonically increasing and strictly within scene bounds
    for i in range(len(kf_long) - 1):
        assert kf_long[i] < kf_long[i+1]
        assert 100.0 <= kf_long[i] <= 220.0

    # 5. Very long scene (1800s / 30 minutes) -> capped at 30 keyframes
    kf_30m = VisualIndexingService.calculate_scene_keyframe_timestamps(0.0, 1800.0, 1800.0)
    assert len(kf_30m) == 30
    assert all(0.0 <= t <= 1800.0 for t in kf_30m)


def test_search_tight_moment_clustering_not_sprawling():
    """Verify that search results do not merge distinct scene events into a full-video span"""
    service = UnifiedSearchService()

    # Mock candidate matches at disparate timestamps (Scene 1 at 2.0s, Scene 3 at 45.0s)
    visual_matches = [
        {
            "keyframe_id": 1,
            "similarity": 0.35,
            "is_action_match": True,
            "metadata": {
                "media_id": 999,
                "timestamp": 2.5,
                "scene_id": 101,
                "scene_index": 0,
                "file_path": "keyframes/999/kf1.jpg",
            },
        },
        {
            "keyframe_id": 2,
            "similarity": 0.38,
            "is_action_match": True,
            "metadata": {
                "media_id": 999,
                "timestamp": 45.0,
                "scene_id": 103,
                "scene_index": 2,
                "file_path": "keyframes/999/kf2.jpg",
            },
        },
    ]

    class MockMedia:
        id = 999
        filename = "test_long_movie.mp4"
        duration = 1800.0
        thumbnail_path = "thumbnails/999/thumb.jpg"

    class MockDB:
        def query(self, model):
            class Query:
                def filter(self, *args, **kwargs):
                    return self
                def first(self):
                    return MockMedia()
            return Query()

    results = service._fuse_multimodal_moments(
        query="person walks outside",
        has_ref_image=False,
        mode=SearchMode.ACTION,
        transcript_matches=[],
        visual_matches=visual_matches,
        person_matches=[],
        db=MockDB(),
    )

    # Must produce 2 separate localized moments, NOT 1 huge moment from 0 to 47 seconds
    assert len(results) == 2
    for r in results:
        # Each moment duration must be tight (<= 12 seconds)
        duration = r.end_time - r.start_time
        assert duration <= 12.0
        assert 0.0 <= r.start_time <= 1800.0
        assert 0.0 <= r.end_time <= 1800.0
