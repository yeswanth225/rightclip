"""Application configuration management"""

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


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
    database_url: str = f"sqlite:///{BASE_DIR / 'clipfinder.db'}"

    # Media Storage
    media_storage_path: str = str(BASE_DIR / "media")

    # Security
    allowed_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"

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

    # Visual Embedding Settings
    clip_model_name: str = "ViT-B-32"
    clip_pretrained: str = "openai"  # openai or laion2b_s34b_b79k
    clip_device: str = "auto"  # auto, cuda, cpu
    clip_batch_size: int = 16

    # Vector Storage Settings
    chroma_persist_dir: str = str(BASE_DIR / "data" / "chroma_db")
    chroma_collection_name: str = "keyframes_vit_b_32"

    # Unified Search & Ranking Settings
    search_temporal_window_seconds: float = 6.0
    search_transcript_weight: float = 0.45
    search_visual_weight: float = 0.45
    search_agreement_bonus: float = 0.10
    search_min_visual_score: float = 0.18
    search_default_limit: int = 15




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
