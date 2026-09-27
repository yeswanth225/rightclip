"""Media source abstractions for ingesting media from uploads or URLs"""

from abc import ABC, abstractmethod
from pathlib import Path
import httpx


class BaseMediaSource(ABC):
    """Abstract base class for media sources"""

    @abstractmethod
    async def fetch(self, target_path: Path) -> Path:
        """Fetch media content and save to target_path"""
        pass


class LocalUploadSource(BaseMediaSource):
    """Media source for direct file uploads"""

    def __init__(self, content: bytes, filename: str):
        self.content = content
        self.filename = filename

    async def fetch(self, target_path: Path) -> Path:
        target_path = Path(target_path)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(self.content)
        return target_path


class DirectURLSource(BaseMediaSource):
    """Media source for downloading media from direct HTTP/HTTPS URLs"""

    def __init__(self, url: str):
        self.url = url

    async def fetch(self, target_path: Path) -> Path:
        target_path = Path(target_path)
        target_path.parent.mkdir(parents=True, exist_ok=True)

        async with httpx.AsyncClient(follow_redirects=True, timeout=120.0) as client:
            async with client.stream("GET", self.url) as response:
                response.raise_for_status()
                with open(target_path, "wb") as f:
                    async for chunk in response.aiter_bytes(chunk_size=65536):
                        f.write(chunk)

        return target_path
