"""FastAPI application entry point"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api import health, media
from app.core.config import get_settings
from app.core.database import Base, engine

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager

    Handles startup and shutdown events
    """
    # Startup: Create database tables
    Base.metadata.create_all(bind=engine)
    yield
    # Shutdown: Cleanup if needed
    pass


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=__version__,
    description="AI-powered video search and clipping platform",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(media.router, prefix="/api", tags=["media"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "ClipFinder API",
        "version": __version__,
        "docs": "/docs",
    }
