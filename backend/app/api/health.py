"""Health check and system status endpoints"""

from datetime import datetime

from fastapi import APIRouter

from app import __version__
from app.schemas.media import HealthCheckResponse

router = APIRouter()


@router.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """
    Health check endpoint

    Returns the current status of the API
    """
    return HealthCheckResponse(
        status="healthy",
        version=__version__,
        timestamp=datetime.utcnow(),
    )
