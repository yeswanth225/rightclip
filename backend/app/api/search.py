"""Unified and Multimodal Search API Router"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.media import MediaAsset
from app.schemas.search import MultimodalSearchRequest, SearchMode, UnifiedSearchResponse
from app.services.search.unified_service import UnifiedSearchService

router = APIRouter()


@router.get("/search", response_model=UnifiedSearchResponse)
async def search_media_get(
    q: Optional[str] = Query(None, description="Natural language search prompt (e.g. 'opens car door' or speech quote)"),
    media_id: Optional[int] = Query(None, description="Optional media asset ID filter"),
    mode: SearchMode = Query(SearchMode.HYBRID, description="Search retrieval mode (hybrid, action, dialogue, visual, person)"),
    limit: Optional[int] = Query(None, ge=1, le=100, description="Max result count"),
    db: Session = Depends(get_db),
):
    """
    Unified AI Multimodal Search (GET): retrieves temporal video moments matching natural language actions,
    exact/semantic dialogue, or visual concepts.
    """
    clean_query = (q or "").strip()
    if not clean_query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query cannot be empty",
        )

    if media_id is not None:
        media_exists = db.query(MediaAsset).filter(MediaAsset.id == media_id).first()
        if not media_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Media asset with ID {media_id} not found",
            )

    try:
        search_service = UnifiedSearchService()
        response = search_service.unified_search(
            query=clean_query,
            reference_image_base64=None,
            db=db,
            media_id=media_id,
            mode=mode,
            limit=limit,
        )
        return response
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception(f"Unified search execution failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unified search failed: {str(e)}",
        )


@router.post("/search", response_model=UnifiedSearchResponse)
async def search_media_post(
    request: MultimodalSearchRequest,
    db: Session = Depends(get_db),
):
    """
    Multimodal Search (POST): supports image reference search (finding a person / face across video),
    image + text action search, image + dialogue search, and natural language action search.
    """
    query = (request.query or "").strip()
    ref_image = request.reference_image_base64

    if not query and not ref_image:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either query text or reference_image_base64 must be provided",
        )

    if request.media_id is not None:
        media_exists = db.query(MediaAsset).filter(MediaAsset.id == request.media_id).first()
        if not media_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Media asset with ID {request.media_id} not found",
            )

    try:
        search_service = UnifiedSearchService()
        response = search_service.unified_search(
            query=query,
            reference_image_base64=ref_image,
            db=db,
            media_id=request.media_id,
            mode=request.mode,
            limit=request.limit,
        )
        return response
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception(f"Multimodal search POST execution failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Multimodal search failed: {str(e)}",
        )
