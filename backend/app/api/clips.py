"""Clip management endpoints for Phase 7 clip editing and saved selections"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.media import MediaAsset
from app.models.clip import Clip
from app.schemas.clip import (
    ClipCreate,
    ClipUpdate,
    ClipResponse,
    ClipListResponse,
)

router = APIRouter()


@router.post("/clips", response_model=ClipResponse, status_code=status.HTTP_201_CREATED)
def create_clip(
    clip_in: ClipCreate,
    db: Session = Depends(get_db),
):
    """
    Create a new saved clip boundary selection
    """
    media = db.query(MediaAsset).filter(MediaAsset.id == clip_in.media_id).first()
    if not media:
        raise HTTPException(status_code=404, detail="Media asset not found")

    if media.duration and clip_in.end_time > media.duration + 0.05:
        raise HTTPException(
            status_code=400,
            detail=f"end_time ({clip_in.end_time:.2f}s) exceeds media duration ({media.duration:.2f}s)",
        )

    duration = round(clip_in.end_time - clip_in.start_time, 3)

    clip = Clip(
        media_id=clip_in.media_id,
        title=clip_in.title,
        start_time=clip_in.start_time,
        end_time=clip_in.end_time,
        duration=duration,
        search_query=clip_in.search_query,
        evidence_json=clip_in.evidence_json,
    )
    db.add(clip)
    db.commit()
    db.refresh(clip)
    return clip


@router.get("/media/{media_id}/clips", response_model=ClipListResponse)
def list_media_clips(
    media_id: int,
    db: Session = Depends(get_db),
):
    """
    Get all saved clips for a specific media asset
    """
    media = db.query(MediaAsset).filter(MediaAsset.id == media_id).first()
    if not media:
        raise HTTPException(status_code=404, detail="Media asset not found")

    clips = db.query(Clip).filter(Clip.media_id == media_id).order_by(Clip.created_at.desc()).all()
    return ClipListResponse(
        media_id=media_id,
        total_clips=len(clips),
        clips=clips,
    )


@router.get("/clips/{clip_id}", response_model=ClipResponse)
def get_clip(
    clip_id: int,
    db: Session = Depends(get_db),
):
    """
    Get a single clip by ID
    """
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")
    return clip


@router.put("/clips/{clip_id}", response_model=ClipResponse)
def update_clip(
    clip_id: int,
    clip_update: ClipUpdate,
    db: Session = Depends(get_db),
):
    """
    Update clip boundaries or title
    """
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    new_start = clip_update.start_time if clip_update.start_time is not None else clip.start_time
    new_end = clip_update.end_time if clip_update.end_time is not None else clip.end_time

    if new_start >= new_end:
        raise HTTPException(status_code=400, detail="start_time must be strictly less than end_time")

    media = db.query(MediaAsset).filter(MediaAsset.id == clip.media_id).first()
    if media and media.duration and new_end > media.duration + 0.05:
        raise HTTPException(status_code=400, detail=f"end_time exceeds media duration ({media.duration:.2f}s)")

    if clip_update.title is not None:
        clip.title = clip_update.title
    clip.start_time = new_start
    clip.end_time = new_end
    clip.duration = round(new_end - new_start, 3)

    db.commit()
    db.refresh(clip)
    return clip


@router.delete("/clips/{clip_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_clip(
    clip_id: int,
    db: Session = Depends(get_db),
):
    """
    Delete a clip
    """
    clip = db.query(Clip).filter(Clip.id == clip_id).first()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    db.delete(clip)
    db.commit()
    return None
