"""End-to-end benchmark and verification script for Phase 5 Visual-Semantic Indexing"""

import os
import sys
import time
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from app.core.database import SessionLocal, Base, engine
from app.models.media import MediaAsset, MediaStatus
from app.models.scene import Scene
from app.models.visual import Keyframe
from app.services.media.processor import FFmpegProcessor
from app.services.scenes.service import SceneService
from app.services.embeddings.clip_provider import OpenCLIPProvider
from app.services.vector.chroma_provider import ChromaVectorProvider
from app.services.indexing.visual_service import VisualIndexingService

def run_benchmark():
    print("=" * 60)
    print("PHASE 5: REAL VIDEO VERIFICATION & BENCHMARK")
    print("=" * 60)

    Base.metadata.create_all(bind=engine)

    video_path = Path("d:/clip/multiscene_video.mp4")
    if not video_path.exists():
        print(f"ERROR: Video {video_path} not found!")
        return

    db = SessionLocal()
    try:
        # 1. Create Media Asset
        asset = MediaAsset(
            filename="multiscene_video.mp4",
            source_type="upload",
            status=MediaStatus.PROCESSING,
            file_path=str(video_path),
            duration=12.0,
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
        print(f"[1] Created media asset: id={asset.id}, filename={asset.filename}")

        # 2. Run Scene Detection
        scene_service = SceneService()
        scenes = scene_service.process_media_scenes(media_id=asset.id, db=db, video_path=video_path)
        print(f"[2] Scene detection complete: {len(scenes)} scenes detected.")
        for s in scenes:
            print(f"    - Scene {s.scene_index}: {s.start_time:.2f}s -> {s.end_time:.2f}s ({s.duration:.2f}s)")

        # 3. Benchmark OpenCLIP Model Load Time
        print("[3] Initializing OpenCLIP ViT-B/32...")
        t0 = time.perf_counter()
        clip_provider = OpenCLIPProvider()
        # Trigger lazy load
        clip_provider._ensure_model_loaded()
        load_duration = time.perf_counter() - t0
        print(f"    - Device: {clip_provider.device}")
        print(f"    - Model Load Latency: {load_duration:.3f} seconds")

        # 4. Run Visual Indexing & Measure Performance
        chroma_provider = ChromaVectorProvider()
        visual_service = VisualIndexingService(
            embedding_provider=clip_provider,
            vector_provider=chroma_provider,
        )

        t_idx_start = time.perf_counter()
        keyframes = visual_service.index_media_visuals(
            media_id=asset.id,
            db=db,
            video_path=video_path,
        )
        idx_duration = time.perf_counter() - t_idx_start
        print(f"[4] Visual indexing complete in {idx_duration:.3f} seconds.")
        print(f"    - Extracted & Indexed Keyframes: {len(keyframes)}")
        if keyframes:
            avg_per_kf = (idx_duration / len(keyframes)) * 1000
            print(f"    - Average End-to-End Latency per Keyframe: {avg_per_kf:.1f} ms")

        for kf in keyframes:
            print(f"    - Keyframe id={kf.id}, scene_id={kf.scene_id}, time={kf.timestamp:.2f}s, vector_id={kf.vector_id}")

        # 5. Test Natural Language Visual Query & verify Keyframe.id mapping
        test_queries = [
            "a bright blue circle or shape",
            "red square screen transition",
            "green nature background",
            "dark scene with text",
        ]
        print("[5] Testing Natural Language Visual Search Queries & keyframe_id integrity:")
        for q in test_queries:
            t_q = time.perf_counter()
            results = visual_service.search_similar_keyframes(query_text=q, top_k=3, media_id=asset.id)
            q_time = (time.perf_counter() - t_q) * 1000
            print(f"    Query: '{q}' ({q_time:.1f} ms)")
            for r in results:
                meta = r["metadata"]
                kf_id = meta.get("keyframe_id")
                # Verify keyframe exists in database with matching ID
                db_kf = db.query(Keyframe).filter(Keyframe.id == kf_id).first()
                assert db_kf is not None, f"Chroma keyframe_id {kf_id} not found in DB!"
                assert db_kf.media_id == asset.id
                assert db_kf.timestamp == meta["timestamp"]
                print(f"      -> Top Match: kf_id={kf_id} (DB verified), sim={r['similarity']:.4f}, scene={meta['scene_index']}, time={meta['timestamp']}s")

        # 6. Verify Idempotent Re-indexing (No Duplicates)
        print("[6] Verifying Re-indexing Idempotence...")
        keyframes_re = visual_service.index_media_visuals(media_id=asset.id, db=db, video_path=video_path)
        count_db = db.query(Keyframe).filter(Keyframe.media_id == asset.id).count()
        print(f"    - Keyframes count in DB after re-index: {count_db} (expected {len(keyframes)})")
        assert count_db == len(keyframes), f"Expected {len(keyframes)}, got {count_db}"

        # 7. Verify Cleanup on Asset Deletion
        print("[7] Verifying Deletion Cleanup...")
        chroma_provider.delete_by_media_id(asset.id)
        db.delete(asset)
        db.commit()
        count_after_del = db.query(Keyframe).filter(Keyframe.media_id == asset.id).count()
        print(f"    - Keyframes count in DB after delete: {count_after_del} (expected 0)")
        assert count_after_del == 0

        print("=" * 60)
        print("ALL VERIFICATIONS AND BENCHMARKS PASSED SUCCESSFULLY!")
        print("=" * 60)

    finally:
        db.close()

if __name__ == "__main__":
    run_benchmark()
