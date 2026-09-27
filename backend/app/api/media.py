"""Media management endpoints"""

import asyncio
from pathlib import Path
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session


from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import SecurityValidator
from app.models import MediaAsset, MediaStatus
from app.schemas.media import (
    MediaAssetResponse,
    MediaUploadResponse,
    MediaURLIngestRequest,
)
from app.services.media.processor import FFmpegProcessor
from app.services.media.sources import DirectURLSource, LocalUploadSource
from app.services.media.validator import MediaValidator

router = APIRouter()
settings = get_settings()


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
    media_assets = (
        db.query(MediaAsset)
        .order_by(MediaAsset.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
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
        raise HTTPException(status_code=404, detail="Media asset not found")

    return media_asset


@router.delete("/media/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_media(
    media_id: int,
    db: Session = Depends(get_db),
):
    """
    Delete a media asset, its database records, keyframes, scenes, associated vector embeddings,
    and physical storage files.

    Args:
        media_id: Media asset ID
        db: Database session
    """
    import shutil
    import logging

    media_asset = db.query(MediaAsset).filter(MediaAsset.id == media_id).first()
    if not media_asset:
        raise HTTPException(status_code=404, detail="Media asset not found")

    # 1. Clean up ChromaDB vectors
    try:
        from app.services.vector.chroma_provider import ChromaVectorProvider
        vector_provider = ChromaVectorProvider()
        vector_provider.delete_by_media_id(media_id)
    except Exception as e:
        logging.getLogger(__name__).warning(f"Failed to cleanup vectors for media {media_id}: {e}")

    # 2. Clean up media-specific filesystem directories safely
    try:
        storage_base = Path(settings.media_storage_path).resolve()
        subdirs = ["originals", "proxies", "thumbnails", "scenes", "keyframes"]
        for sub in subdirs:
            media_folder = (storage_base / sub / str(media_id)).resolve()
            # Ensure path traversal protection: target must be inside storage_base
            if storage_base in media_folder.parents and media_folder.exists():
                shutil.rmtree(media_folder, ignore_errors=True)
    except Exception as fs_err:
        logging.getLogger(__name__).warning(f"Failed to cleanup files for media {media_id}: {fs_err}")

    # 3. Delete media record (cascade will handle transcripts, scenes, keyframes in DB)
    db.delete(media_asset)
    db.commit()
    return None



@router.post("/media/upload", response_model=MediaUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_media(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload a media file

    Args:
        background_tasks: FastAPI background tasks
        file: Uploaded file
        db: Database session

    Returns:
        Created media asset information
    """
    # Validate filename
    is_valid, error = MediaValidator.validate_filename(file.filename)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)

    # Read file content
    file_content = await file.read()

    # Validate file size
    is_valid, error = MediaValidator.validate_file_size(len(file_content))
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error)

    # Sanitize filename
    safe_filename = MediaValidator.sanitize_filename(file.filename)

    # Create media asset record
    media_asset = MediaAsset(
        filename=safe_filename,
        source_type="upload",
        status=MediaStatus.UPLOADED,
        file_size=len(file_content),
    )
    db.add(media_asset)
    db.commit()
    db.refresh(media_asset)

    # Create source
    source = LocalUploadSource(file_content, safe_filename)

    # Process media in background
    background_tasks.add_task(_process_media_task, media_asset.id, source)

    return MediaUploadResponse(
        id=media_asset.id,
        filename=safe_filename,
        status=media_asset.status,
        message="Media uploaded successfully. Processing started.",
    )


@router.post("/media/url", response_model=MediaUploadResponse, status_code=status.HTTP_201_CREATED)
async def ingest_media_url(
    request: MediaURLIngestRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Ingest media from URL

    Args:
        request: URL ingestion request
        background_tasks: FastAPI background tasks
        db: Database session

    Returns:
        Created media asset information
    """
    # Validate URL security
    SecurityValidator.validate_url_or_raise(request.url)

    # Extract filename from URL
    from urllib.parse import urlparse

    parsed = urlparse(request.url)
    filename = Path(parsed.path).name or "downloaded_video.mp4"

    # Validate filename
    is_valid, error = MediaValidator.validate_filename(filename)
    if not is_valid:
        # Use generic filename if URL doesn't have valid filename
        filename = "downloaded_video.mp4"

    # Sanitize filename
    safe_filename = MediaValidator.sanitize_filename(filename)

    # Create media asset record
    media_asset = MediaAsset(
        filename=safe_filename,
        source_type="url",
        source_url=request.url,
        status=MediaStatus.DOWNLOADING,
    )
    db.add(media_asset)
    db.commit()
    db.refresh(media_asset)

    # Create source
    source = DirectURLSource(request.url)

    # Process media in background
    background_tasks.add_task(_process_media_task, media_asset.id, source)

    return MediaUploadResponse(
        id=media_asset.id,
        filename=safe_filename,
        status=media_asset.status,
        message="URL accepted. Downloading and processing started.",
    )


async def _process_media_task(media_id: int, source):
    """Background task entry point for media processing"""
    await _process_media(media_id, source)



async def _process_media(media_id: int, source):
    """
    Background task to process uploaded media

    Args:
        media_id: Media asset ID
        source: MediaSource instance
    """

    from sqlalchemy.orm import Session as SessionType

    # Create new DB session for background task
    from app.core.database import SessionLocal

    db_session: SessionType = SessionLocal()

    try:
        # Get media asset
        media_asset = db_session.query(MediaAsset).filter(MediaAsset.id == media_id).first()
        if not media_asset:
            return

        # Define storage paths
        storage_base = Path(settings.media_storage_path)
        original_dir = storage_base / "originals" / str(media_id)
        original_path = original_dir / media_asset.filename

        # Fetch media
        await source.fetch(original_path)

        # Update status
        media_asset.status = MediaStatus.VALIDATING
        media_asset.file_path = original_path.as_posix()
        if not media_asset.file_size:
            media_asset.file_size = original_path.stat().st_size
        db_session.commit()

        # Extract metadata
        metadata = FFmpegProcessor.extract_metadata(original_path)

        # Validate media
        is_valid, error = FFmpegProcessor.validate_media(
            metadata, settings.max_video_duration_seconds
        )
        if not is_valid:
            media_asset.status = MediaStatus.FAILED
            media_asset.error_message = error
            db_session.commit()
            return

        # Update metadata
        media_asset.duration = metadata.get("duration")
        media_asset.width = metadata.get("width")
        media_asset.height = metadata.get("height")
        media_asset.fps = metadata.get("fps")
        media_asset.video_codec = metadata.get("video_codec")
        media_asset.audio_codec = metadata.get("audio_codec")
        media_asset.metadata_json = metadata
        db_session.commit()

        # Update status to processing
        media_asset.status = MediaStatus.PROCESSING
        db_session.commit()

        # Generate proxy
        proxy_dir = storage_base / "proxies" / str(media_id)
        proxy_filename = f"{Path(media_asset.filename).stem}_proxy.mp4"
        proxy_path = proxy_dir / proxy_filename

        FFmpegProcessor.generate_proxy(original_path, proxy_path, target_height=720)
        media_asset.proxy_path = proxy_path.as_posix()
        db_session.commit()

        # Extract thumbnail
        thumbnail_dir = storage_base / "thumbnails" / str(media_id)
        thumbnail_filename = f"{Path(media_asset.filename).stem}_thumb.jpg"
        thumbnail_path = thumbnail_dir / thumbnail_filename

        # Extract thumbnail at 10 seconds or 10% of duration, whichever is smaller
        thumbnail_time = min(10.0, media_asset.duration * 0.1)
        FFmpegProcessor.extract_thumbnail(original_path, thumbnail_path, thumbnail_time)
        media_asset.thumbnail_path = thumbnail_path.as_posix()
        db_session.commit()


        # Run speech-to-text transcription
        try:
            from app.services.transcription.service import TranscriptionService
            transcription_service = TranscriptionService()
            transcription_service.process_media_transcription(
                media_id=media_id,
                db=db_session,
                media_path=proxy_path if proxy_path.exists() else original_path,
            )
        except Exception as transcript_err:
            # Log transcription error without failing the whole media asset
            import logging
            logging.getLogger(__name__).warning(f"Transcription failed for media {media_id}: {transcript_err}")

        # Run scene boundary detection
        try:
            from app.services.scenes.service import SceneService
            scene_service = SceneService()
            scene_service.process_media_scenes(
                media_id=media_id,
                db=db_session,
                video_path=proxy_path if proxy_path.exists() else original_path,
            )
        except Exception as scene_err:
            import logging
            logging.getLogger(__name__).warning(f"Scene detection failed for media {media_id}: {scene_err}")

        # Run visual-semantic keyframing & vector indexing
        try:
            from app.services.indexing.visual_service import VisualIndexingService
            visual_service = VisualIndexingService()
            visual_service.index_media_visuals(
                media_id=media_id,
                db=db_session,
                video_path=proxy_path if proxy_path.exists() else original_path,
            )
        except Exception as visual_err:
            import logging
            logging.getLogger(__name__).warning(f"Visual indexing failed for media {media_id}: {visual_err}")

        # Physical verification of proxy before marking ready
        if not proxy_path.exists() or proxy_path.stat().st_size == 0:
            raise RuntimeError(f"Proxy file missing or invalid prior to ready state: {proxy_path}")

        # Mark as ready
        media_asset.status = MediaStatus.READY
        media_asset.error_message = None
        db_session.commit()



    except Exception as e:
        # Mark as failed
        media_asset = db_session.query(MediaAsset).filter(MediaAsset.id == media_id).first()
        if media_asset:
            media_asset.status = MediaStatus.FAILED
            media_asset.error_message = str(e)
            db_session.commit()

    finally:
        db_session.close()

