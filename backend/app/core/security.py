"""Security utilities and validation"""

import re
from typing import Optional
from urllib.parse import urlparse

from fastapi import HTTPException, status


class SecurityValidator:
    """Security validation utilities"""

    # Private/internal IP ranges (SSRF protection)
    PRIVATE_IP_PATTERNS = [
        r"^127\.",  # Loopback
        r"^10\.",  # Private class A
        r"^172\.(1[6-9]|2[0-9]|3[0-1])\.",  # Private class B
        r"^192\.168\.",  # Private class C
        r"^169\.254\.",  # Link-local
        r"^::1$",  # IPv6 loopback
        r"^fe80:",  # IPv6 link-local
        r"^fc00:",  # IPv6 unique local
        r"^fd00:",  # IPv6 unique local
    ]

    # Allowed URL schemes
    ALLOWED_SCHEMES = {"http", "https"}

    @classmethod
    def validate_url(cls, url: str) -> tuple[bool, Optional[str]]:
        """
        Validate URL for security concerns

        Returns:
            (is_valid, error_message)
        """
        try:
            parsed = urlparse(url)

            # Check scheme
            if parsed.scheme not in cls.ALLOWED_SCHEMES:
                return False, f"Only {', '.join(cls.ALLOWED_SCHEMES)} schemes are allowed"

            # Check hostname exists
            if not parsed.hostname:
                return False, "Invalid URL: no hostname"

            hostname = parsed.hostname.lower()

            # Check for localhost
            if hostname in {"localhost", "127.0.0.1", "0.0.0.0", "::1"}:
                return False, "Cannot access localhost URLs"

            # Check for private IP ranges
            for pattern in cls.PRIVATE_IP_PATTERNS:
                if re.match(pattern, hostname):
                    return False, "Cannot access private network URLs"

            return True, None

        except Exception as e:
            return False, f"Invalid URL format: {str(e)}"

    @classmethod
    def validate_url_or_raise(cls, url: str) -> None:
        """
        Validate URL and raise HTTPException if invalid

        Raises:
            HTTPException: If URL validation fails
        """
        is_valid, error = cls.validate_url(url)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error,
            )

    @classmethod
    def validate_file_extension(cls, filename: str, allowed_extensions: set[str]) -> bool:
        """
        Validate file extension

        Args:
            filename: The filename to validate
            allowed_extensions: Set of allowed extensions (e.g., {'.mp4', '.mkv'})

        Returns:
            True if extension is allowed
        """
        if not filename:
            return False

        extension = "." + filename.lower().split(".")[-1] if "." in filename else ""
        return extension in allowed_extensions

    @classmethod
    def validate_file_size(cls, size_bytes: int, max_size_bytes: int) -> bool:
        """
        Validate file size

        Args:
            size_bytes: File size in bytes
            max_size_bytes: Maximum allowed size in bytes

        Returns:
            True if size is within limit
        """
        return 0 < size_bytes <= max_size_bytes
