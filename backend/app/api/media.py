"""Media management endpoints"""

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import MediaAsset
from app.schemas.media import MediaAssetResponse

router = APIRouter()


@router.get("/media", response_model=List[MediaAssetResponse])
async def list_media(
    skip: int = 0,
    limit: int = 10,
    db: Session = Depends(get_db),
):
    """
    List all media assets

    Args:
        skip: Number of records to skip
        limit: Maximum number of records to return
        db: Database session

    Returns:
        List of media assets
    """
    media_assets = db.query(MediaAsset).offset(skip).limit(limit).all()
    return media_assets


@router.get("/media/{media_id}", response_model=MediaAssetResponse)
async def get_media(
    media_id: int,
    db: Session = Depends(get_db),
):
    """
    Get a specific media asset by ID

    Args:
        media_id: Media asset ID
        db: Database session

    Returns:
        Media asset details
    """
    media_asset = db.query(MediaAsset).filter(MediaAsset.id == media_id).first()

    if not media_asset:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Media asset not found")

    return media_asset
