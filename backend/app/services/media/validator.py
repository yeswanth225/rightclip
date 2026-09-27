"""Media validation utilities"""

import re
from pathlib import Path
from typing import Optional, Set

from app.core.config import get_settings


class MediaValidator:
    """Validator for uploaded and ingested media files"""

    ALLOWED_EXTENSIONS: Set[str] = {
        ".mp4",
        ".mov",
        ".avi",
        ".mkv",
        ".webm",
        ".m4v",
        ".flv",
        ".wmv",
        ".ts",
        ".mp3",
        ".wav",
        ".m4a",
        ".aac",
    }

    @classmethod
    def validate_filename(cls, filename: str) -> tuple[bool, Optional[str]]:
        """
        Validate filename for allowed extensions and path traversal.

        Args:
            filename: The filename to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not filename or not isinstance(filename, str):
            return False, "Filename is required"

        # Check for path traversal characters in input filename
        if ".." in filename or "/" in filename or "\\" in filename:
            return False, "Invalid filename: path traversal attempt detected"

        ext = Path(filename).suffix.lower()
        if not ext or ext not in cls.ALLOWED_EXTENSIONS:
            allowed_list = ", ".join(sorted(cls.ALLOWED_EXTENSIONS))
            return False, f"Invalid file extension '{ext}'. Allowed extensions: {allowed_list}"

        return True, None

    @classmethod
    def sanitize_filename(cls, filename: str) -> str:
        """
        Sanitize a filename by removing path traversal characters and
        replacing special characters with underscores while preserving the extension.

        Args:
            filename: Raw input filename

        Returns:
            Sanitized safe filename
        """
        # Remove any path components
        base_name = Path(filename.replace("\\", "/")).name

        stem = Path(base_name).stem
        ext = Path(base_name).suffix.lower()

        # Replace non-alphanumeric/underscore/hyphen characters in stem with '_'
        sanitized_stem = re.sub(r"[^a-zA-Z0-9_\-]", "_", stem)
        # Ensure clean extension
        sanitized_ext = re.sub(r"[^a-zA-Z0-9]", "", ext)
        if sanitized_ext:
            sanitized_ext = f".{sanitized_ext}"

        if not sanitized_stem:
            sanitized_stem = "media_file"

        return f"{sanitized_stem}{sanitized_ext}"

    @classmethod
    def validate_file_size(
        cls, size_bytes: int, max_size_bytes: Optional[int] = None
    ) -> tuple[bool, Optional[str]]:
        """
        Validate file size against 0 bytes and maximum configured size.

        Args:
            size_bytes: Size in bytes
            max_size_bytes: Optional max size threshold (defaults to settings)

        Returns:
            Tuple of (is_valid, error_message)
        """
        if max_size_bytes is None:
            settings = get_settings()
            max_size_bytes = settings.max_upload_size_bytes

        if size_bytes <= 0:
            return False, "File is empty (0 bytes)"

        if size_bytes > max_size_bytes:
            return (
                False,
                f"File size ({size_bytes} bytes) exceeds maximum allowed size ({max_size_bytes} bytes)",
            )

        return True, None
