"""Transcript API endpoints"""

import asyncio
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.media import MediaAsset
from app.models.transcript import Transcript, TranscriptSegment, TranscriptStatus
from app.schemas.transcript import TranscriptResponse, TranscriptSegmentResponse
from app.services.transcription.service import TranscriptionService

router = APIRouter()


@router.get("/media/{media_id}/transcript", response_model=TranscriptResponse)
async def get_media_transcript(
    media_id: int,
    db: Session = Depends(get_db),
):
    """
    Get the complete transcript and timestamped segments for a media asset.

    Args:
        media_id: Media asset ID
        db: Database session

    Returns:
        TranscriptResponse with metadata and list of segments
    """
    # Verify media asset exists
    media_asset = db.query(MediaAsset).filter(MediaAsset.id == media_id).first()
    if not media_asset:
        raise HTTPException(status_code=404, detail="Media asset not found")

    transcript = db.query(Transcript).filter(Transcript.media_id == media_id).first()
    if not transcript:
        raise HTTPException(
            status_code=404,
            detail="Transcript not found for this media asset",
        )

    return transcript


@router.get("/media/{media_id}/transcript/segments", response_model=List[TranscriptSegmentResponse])
async def get_transcript_segments(
    media_id: int,
    start_time: Optional[float] = Query(None, description="Filter segments starting after or at this timestamp (seconds)"),
    end_time: Optional[float] = Query(None, description="Filter segments ending before or at this timestamp (seconds)"),
    db: Session = Depends(get_db),
):
    """
    Get timestamped transcript segments for a media asset with optional time range filtering.

    Args:
        media_id: Media asset ID
        start_time: Optional start time filter
        end_time: Optional end time filter
        db: Database session

    Returns:
        List of TranscriptSegmentResponse
    """
    # Verify media asset exists
    media_asset = db.query(MediaAsset).filter(MediaAsset.id == media_id).first()
    if not media_asset:
        raise HTTPException(status_code=404, detail="Media asset not found")

    query = db.query(TranscriptSegment).filter(TranscriptSegment.media_id == media_id)

    if start_time is not None:
        query = query.filter(TranscriptSegment.end_time >= start_time)
    if end_time is not None:
        query = query.filter(TranscriptSegment.start_time <= end_time)

    segments = query.order_by(TranscriptSegment.start_time).all()
    return segments


@router.post("/media/{media_id}/transcribe", response_model=TranscriptResponse, status_code=status.HTTP_202_ACCEPTED)
async def trigger_transcription(
    media_id: int,
    language: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Trigger or re-run transcription for a media asset asynchronously.

    Args:
        media_id: Media asset ID
        language: Optional language hint
        db: Database session

    Returns:
        Transcript record (status will be TRANSCRIBING)
    """
    media_asset = db.query(MediaAsset).filter(MediaAsset.id == media_id).first()
    if not media_asset:
        raise HTTPException(status_code=404, detail="Media asset not found")

    transcript = db.query(Transcript).filter(Transcript.media_id == media_id).first()
    if not transcript:
        transcript = Transcript(
            media_id=media_id,
            status=TranscriptStatus.TRANSCRIBING,
        )
        db.add(transcript)
        db.commit()
        db.refresh(transcript)
    else:
        transcript.status = TranscriptStatus.TRANSCRIBING
        transcript.error_message = None
        db.commit()
        db.refresh(transcript)

    # Spawn background task
    def _run_task():
        from app.core.database import SessionLocal
        task_db = SessionLocal()
        try:
            svc = TranscriptionService()
            svc.process_media_transcription(media_id=media_id, db=task_db, language=language)
        finally:
            task_db.close()

    asyncio.create_task(asyncio.to_thread(_run_task))

    return transcript
