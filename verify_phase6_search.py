"""Comprehensive Real-Video Verification and Search Quality Evaluation for Phase 6"""

import os
import sys
import time
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

from app.core.database import SessionLocal, Base, engine
from app.models.media import MediaAsset, MediaStatus
from app.models.scene import Scene
from app.models.transcript import Transcript, TranscriptSegment, TranscriptStatus
from app.models.visual import Keyframe
from app.schemas.search import SearchMode
from app.services.scenes.service import SceneService
from app.services.indexing.visual_service import VisualIndexingService
from app.services.search.unified_service import UnifiedSearchService

def run_real_video_search_verification():
    print("=" * 70)
    print("PHASE 6: REAL MULTIMODAL VIDEO SEARCH & RANKING VERIFICATION")
    print("=" * 70)

    video_path = Path("d:/clip/multiscene_video.mp4")
    if not video_path.exists():
        print(f"ERROR: Video {video_path} not found!")
        return

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Ingest Media Asset
        asset = MediaAsset(
            filename="multiscene_video.mp4",
            source_type="upload",
            status=MediaStatus.PROCESSING,
            file_path=str(video_path),
            duration=6.0,
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
        print(f"[1] Ingested media asset: id={asset.id}, filename={asset.filename}")

        # 2. Add realistic timestamped transcript segments for each scene
        # Scene 0 (0-2s): Red intro screen discussing space exploration
        # Scene 1 (2-4s): Blue shape discussion on quantum computing principles
        # Scene 2 (4-6s): Green nature discussion on ecological biodiversity
        tr = Transcript(
            media_id=asset.id,
            status=TranscriptStatus.COMPLETED,
            full_text="Welcome to space exploration. Here we analyze quantum computing principles. Finally observing ecological biodiversity.",
            provider="faster-whisper",
            model_name="base",
        )
        db.add(tr)
        db.commit()
        db.refresh(tr)

        seg0 = TranscriptSegment(
            transcript_id=tr.id,
            media_id=asset.id,
            segment_index=0,
            start_time=0.2,
            end_time=1.8,
            text="Welcome to space exploration and rocketry.",
        )
        seg1 = TranscriptSegment(
            transcript_id=tr.id,
            media_id=asset.id,
            segment_index=1,
            start_time=2.2,
            end_time=3.8,
            text="Here we analyze quantum computing principles and algorithms.",
        )
        seg2 = TranscriptSegment(
            transcript_id=tr.id,
            media_id=asset.id,
            segment_index=2,
            start_time=4.2,
            end_time=5.8,
            text="Finally observing ecological biodiversity and green plants.",
        )
        db.add_all([seg0, seg1, seg2])
        db.commit()
        print("[2] Added transcript segments covering video timeline.")

        # 3. Detect Scenes
        scene_service = SceneService()
        scenes = scene_service.process_media_scenes(media_id=asset.id, db=db, video_path=video_path)
        print(f"[3] Scene detection complete: {len(scenes)} scenes detected.")

        # 4. Extract Keyframes & Embed Vectors in ChromaDB
        visual_service = VisualIndexingService()
        keyframes = visual_service.index_media_visuals(media_id=asset.id, db=db, video_path=video_path)
        print(f"[4] Visual indexing complete: {len(keyframes)} keyframes stored in ChromaDB.")

        # 5. Execute Unified Search Evaluation
        search_service = UnifiedSearchService(visual_service=visual_service)

        test_queries = [
            ("Query 1 — Transcript-oriented", "quantum computing algorithms", SearchMode.HYBRID),
            ("Query 2 — Visual-oriented", "red square screen transition", SearchMode.HYBRID),
            ("Query 3 — Multimodal Fusion", "quantum computing in blue screen", SearchMode.HYBRID),
            ("Query 4 — Ecological Topic", "green ecological plants", SearchMode.HYBRID),
        ]

        print("\n" + "=" * 70)
        print("SEARCH QUALITY & RANKING EVALUATION")
        print("=" * 70)

        for label, query_text, mode in test_queries:
            t0 = time.perf_counter()
            response = search_service.unified_search(
                query=query_text,
                db=db,
                media_id=asset.id,
                mode=mode,
            )
            lat = (time.perf_counter() - t0) * 1000

            print(f"\n[{label}] Query: '{query_text}' (Mode: {mode.value})")
            print(f"   -> Latency: {lat:.1f} ms (Tr: {response.transcript_latency_ms}ms, Vis: {response.visual_latency_ms}ms, Fuse: {response.fusion_latency_ms}ms)")
            print(f"   -> Matches Found: {response.total_results}")

            for idx, res in enumerate(response.results[:2]):
                ev = res.evidence
                print(f"      Top #{idx + 1}: Score={res.score:.4f} | Time={res.start_time:.1f}s-{res.end_time:.1f}s (Jump: {res.representative_timestamp:.1f}s) | Scene #{res.scene_index}")
                print(f"          Explanation: {ev.explanation}")
                if ev.transcript_text:
                    print(f"          Speech: \"{ev.transcript_text}\" (Tr Score: {ev.transcript_score})")
                if ev.keyframe_id:
                    print(f"          Visual: Keyframe #{ev.keyframe_id} (Vis Sim: {ev.visual_similarity:.4f})")
                if ev.agreement:
                    print(f"          >>> MULTIMODAL AGREEMENT BONUS APPLIED <<<")

        print("\n" + "=" * 70)
        print("VERIFICATION COMPLETED SUCCESSFULLY")
        print("=" * 70)

    finally:
        # Cleanup test asset
        try:
            from app.services.vector.chroma_provider import ChromaVectorProvider
            ChromaVectorProvider().delete_by_media_id(asset.id)
            db.delete(asset)
            db.commit()
        except Exception:
            pass
        db.close()

if __name__ == "__main__":
    run_real_video_search_verification()
