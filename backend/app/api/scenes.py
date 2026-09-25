"""Scene detection and management API endpoints"""

import asyncio
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.media import MediaAsset
from app.models.scene import Scene
from app.schemas.scene import SceneListResponse, SceneResponse
from app.services.scenes.service import SceneService

router = APIRouter()


@router.get("/media/{media_id}/scenes", response_model=SceneListResponse)
async def get_media_scenes(
    media_id: int,
    start_time: Optional[float] = Query(None, description="Filter scenes occurring at or after start time (seconds)"),
    end_time: Optional[float] = Query(None, description="Filter scenes occurring at or before end time (seconds)"),
    db: Session = Depends(get_db),
):
    """
    Get all detected scenes for a media asset with optional time window filtering.

    Args:
        media_id: Media asset ID
        start_time: Optional start time filter
        end_time: Optional end time filter
        db: Database session

    Returns:
        SceneListResponse with list of SceneResponse items
    """
    media_asset = db.query(MediaAsset).filter(MediaAsset.id == media_id).first()
    if not media_asset:
        raise HTTPException(status_code=404, detail="Media asset not found")

    query = db.query(Scene).filter(Scene.media_id == media_id)

    if start_time is not None:
        query = query.filter(Scene.end_time >= start_time)
    if end_time is not None:
        query = query.filter(Scene.start_time <= end_time)

    scenes = query.order_by(Scene.start_time).all()

    return SceneListResponse(
        media_id=media_id,
        total_scenes=len(scenes),
        scenes=scenes,
    )


@router.get("/media/{media_id}/scenes/{scene_index}", response_model=SceneResponse)
async def get_single_scene(
    media_id: int,
    scene_index: int,
    db: Session = Depends(get_db),
):
    """
    Get a specific scene by index for a media asset.

    Args:
        media_id: Media asset ID
        scene_index: Zero-indexed scene number
        db: Database session

    Returns:
        SceneResponse
    """
    media_asset = db.query(MediaAsset).filter(MediaAsset.id == media_id).first()
    if not media_asset:
        raise HTTPException(status_code=404, detail="Media asset not found")

    scene = (
        db.query(Scene)
        .filter(Scene.media_id == media_id, Scene.scene_index == scene_index)
        .first()
    )
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    return scene


@router.post("/media/{media_id}/scenes/detect", response_model=SceneListResponse, status_code=status.HTTP_202_ACCEPTED)
async def trigger_scene_detection(
    media_id: int,
    detector_type: Optional[str] = None,
    threshold: Optional[float] = None,
    db: Session = Depends(get_db),
):
    """
    Trigger or re-run scene detection for a media asset.

    Args:
        media_id: Media asset ID
        detector_type: Optional detector type override ('content', 'adaptive', 'threshold')
        threshold: Optional threshold override
        db: Database session

    Returns:
        Immediate scene list (or currently existing scenes while background job executes)
    """
    media_asset = db.query(MediaAsset).filter(MediaAsset.id == media_id).first()
    if not media_asset:
        raise HTTPException(status_code=404, detail="Media asset not found")

    def _run_detection():
        from app.core.database import SessionLocal
        from app.services.scenes.detector import PySceneDetectProvider

        task_db = SessionLocal()
        try:
            custom_detector = PySceneDetectProvider(detector_type=detector_type, threshold=threshold)
            svc = SceneService(detector=custom_detector)
            svc.process_media_scenes(media_id=media_id, db=task_db)
        finally:
            task_db.close()

    asyncio.create_task(asyncio.to_thread(_run_detection))

    # Return currently stored scenes
    current_scenes = db.query(Scene).filter(Scene.media_id == media_id).order_by(Scene.start_time).all()
    return SceneListResponse(
        media_id=media_id,
        total_scenes=len(current_scenes),
        scenes=current_scenes,
    )
