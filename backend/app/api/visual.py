"""Visual keyframe and visual similarity search API endpoints"""

import asyncio
import time
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.media import MediaAsset
from app.models.scene import Scene
from app.models.visual import Keyframe
from app.schemas.visual import (
    KeyframeListResponse,
    KeyframeResponse,
    VisualSearchMatchResponse,
    VisualSearchResponse,
)
from app.services.indexing.visual_service import VisualIndexingService

router = APIRouter()


@router.get("/media/{media_id}/keyframes", response_model=KeyframeListResponse)
async def get_media_keyframes(
    media_id: int,
    scene_id: Optional[int] = Query(None, description="Filter keyframes by specific scene ID"),
    db: Session = Depends(get_db),
):
    """
    Get all extracted visual keyframes for a media asset or specific scene.

    Args:
        media_id: Media asset ID
        scene_id: Optional scene ID filter
        db: Database session

    Returns:
        KeyframeListResponse with list of KeyframeResponse
    """
    media_asset = db.query(MediaAsset).filter(MediaAsset.id == media_id).first()
    if not media_asset:
        raise HTTPException(status_code=404, detail="Media asset not found")

    query = db.query(Keyframe).filter(Keyframe.media_id == media_id)
    if scene_id is not None:
        query = query.filter(Keyframe.scene_id == scene_id)

    keyframes = query.order_by(Keyframe.timestamp).all()

    return KeyframeListResponse(
        media_id=media_id,
        scene_id=scene_id,
        total_keyframes=len(keyframes),
        keyframes=keyframes,
    )


@router.post("/media/{media_id}/index-visual", response_model=KeyframeListResponse, status_code=status.HTTP_202_ACCEPTED)
async def trigger_visual_indexing(
    media_id: int,
    db: Session = Depends(get_db),
):
    """
    Trigger or re-run visual keyframing and vector embedding indexing asynchronously.

    Args:
        media_id: Media asset ID
        db: Database session

    Returns:
        Current list of indexed keyframes
    """
    media_asset = db.query(MediaAsset).filter(MediaAsset.id == media_id).first()
    if not media_asset:
        raise HTTPException(status_code=404, detail="Media asset not found")

    def _run_indexing():
        from app.core.database import SessionLocal

        task_db = SessionLocal()
        try:
            svc = VisualIndexingService()
            svc.index_media_visuals(media_id=media_id, db=task_db)
        finally:
            task_db.close()

    asyncio.create_task(asyncio.to_thread(_run_indexing))

    current_keyframes = db.query(Keyframe).filter(Keyframe.media_id == media_id).order_by(Keyframe.timestamp).all()
    return KeyframeListResponse(
        media_id=media_id,
        total_keyframes=len(current_keyframes),
        keyframes=current_keyframes,
    )


@router.get("/visual/search", response_model=VisualSearchResponse)
async def search_visual(
    q: str = Query(..., description="Natural language search query (e.g. 'red car', 'hair flip')"),
    media_id: Optional[int] = Query(None, description="Optional media ID filter"),
    top_k: int = Query(10, ge=1, le=100, description="Maximum number of results"),
    db: Session = Depends(get_db),
):
    """
    Search indexed keyframes by natural language prompt using multimodal vector similarity.

    Args:
        q: Search prompt
        media_id: Optional media filter
        top_k: Result limit
        db: Database session

    Returns:
        VisualSearchResponse with matching keyframes and similarity scores
    """
    start_time = time.perf_counter()
    svc = VisualIndexingService()

    try:
        raw_matches = svc.search_similar_keyframes(query_text=q, top_k=top_k, media_id=media_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Visual search failed: {str(e)}")

    results: List[VisualSearchMatchResponse] = []

    for match in raw_matches:
        meta = match.get("metadata", {})
        results.append(
            VisualSearchMatchResponse(
                keyframe_id=meta.get("keyframe_id", 0),
                media_id=int(meta.get("media_id", 0)),
                scene_id=int(meta.get("scene_id", 0)),
                timestamp=float(meta.get("timestamp", 0.0)),
                file_path=str(meta.get("file_path", "")),
                similarity_score=round(float(match.get("similarity", 0.0)), 4),
                vector_id=str(match.get("id", "")),
            )
        )

    latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

    return VisualSearchResponse(
        query=q,
        total_results=len(results),
        latency_ms=latency_ms,
        results=results,
    )
