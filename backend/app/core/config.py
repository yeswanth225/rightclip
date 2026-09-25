"""Application configuration management"""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings"""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "ClipFinder"
    app_version: str = "0.1.0"
    debug: bool = False

    # Database
    database_url: str = "sqlite:///./clipfinder.db"

    # Media Storage
    media_storage_path: str = "./media"

    # Security
    allowed_origins: str = "http://localhost:5173"

    # Processing Limits
    max_upload_size_mb: int = 2048
    max_video_duration_seconds: int = 7200

    # Transcription Settings
    whisper_model_size: str = "base"
    whisper_device: str = "auto"  # auto, cpu, cuda
    whisper_compute_type: str = "auto"  # auto, int8, float16, float32
    whisper_threads: int = 4

    # Scene Detection Settings
    scene_detector_type: str = "content"  # content, adaptive, threshold
    scene_threshold: float = 27.0
    scene_min_duration_seconds: float = 1.0
    scene_frame_skip: int = 2  # Skip frames to accelerate detection



    @property
    def allowed_origins_list(self) -> List[str]:
        """Parse allowed origins into a list"""
        return [origin.strip() for origin in self.allowed_origins.split(",")]

    @property
    def max_upload_size_bytes(self) -> int:
        """Convert MB to bytes"""
        return self.max_upload_size_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
