"""Unified Search API Router"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.media import MediaAsset
from app.schemas.search import SearchMode, UnifiedSearchResponse
from app.services.search.unified_service import UnifiedSearchService

router = APIRouter()


@router.get("/search", response_model=UnifiedSearchResponse)
async def search_media(
    q: str = Query(..., description="Natural language search prompt (e.g. 'quantum computing blue background')"),
    media_id: Optional[int] = Query(None, description="Optional media asset ID filter"),
    mode: SearchMode = Query(SearchMode.HYBRID, description="Search retrieval mode (hybrid, transcript, visual)"),
    limit: Optional[int] = Query(None, ge=1, le=100, description="Max result count"),
    db: Session = Depends(get_db),
):
    """
    Unified AI Multimodal Search: combines transcript keywords/semantics, OpenCLIP visual vectors,
    temporal scene proximity, and hybrid rank fusion.
    """
    clean_query = q.strip()
    if not clean_query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query cannot be empty or whitespace only",
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
