"""Tests for Phase 8: HTTP media serving, byte-range requests, and proxy reliability"""

import os
import io
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app
from app.services.media.processor import FFmpegProcessor
from app.core.config import get_settings

settings = get_settings()
client = TestClient(app)


@pytest.fixture
def sample_test_video():
    """Create a mock video file for static serving tests"""
    media_dir = Path(settings.media_storage_path)
    test_file = media_dir / "test_stream_video.mp4"
    test_file.parent.mkdir(parents=True, exist_ok=True)
    # Write 10000 bytes of dummy video data
    test_file.write_bytes(b"A" * 10000)
    yield "test_stream_video.mp4"
    if test_file.exists():
        test_file.unlink()


def test_media_static_serving_full_get(sample_test_video):
    """Test standard HTTP GET on media endpoint"""
    response = client.get(f"/media/{sample_test_video}")
    assert response.status_code == 200
    assert response.headers.get("accept-ranges") == "bytes"
    assert "video/mp4" in response.headers.get("content-type", "")
    assert int(response.headers.get("content-length", 0)) == 10000
    assert len(response.content) == 10000


def test_media_static_serving_byte_range(sample_test_video):
    """Test HTTP 206 Partial Content and byte-range request support"""
    # Request bytes 0-499 (500 bytes)
    headers = {"Range": "bytes=0-499"}
    response = client.get(f"/media/{sample_test_video}", headers=headers)
    assert response.status_code == 206
    assert response.headers.get("accept-ranges") == "bytes"
    assert response.headers.get("content-range") == "bytes 0-499/10000"
    assert response.headers.get("content-length") == "500"
    assert len(response.content) == 500


def test_media_static_serving_seek_range(sample_test_video):
    """Test seeking to the middle and end of a media file via Range headers"""
    # Seek near middle: bytes 5000-5999
    headers = {"Range": "bytes=5000-5999"}
    response = client.get(f"/media/{sample_test_video}", headers=headers)
    assert response.status_code == 206
    assert response.headers.get("content-range") == "bytes 5000-5999/10000"
    assert len(response.content) == 1000

    # Seek near end: bytes 9500-9999
    headers = {"Range": "bytes=9500-9999"}
    response = client.get(f"/media/{sample_test_video}", headers=headers)
    assert response.status_code == 206
    assert response.headers.get("content-range") == "bytes 9500-9999/10000"
    assert len(response.content) == 500


def test_media_static_serving_filename_with_spaces_and_special_chars():
    """Test static media serving with spaces and URL encoding"""
    media_dir = Path(settings.media_storage_path)
    special_name = "test video special.mp4"
    test_file = media_dir / special_name
    test_file.parent.mkdir(parents=True, exist_ok=True)
    test_file.write_bytes(b"B" * 2048)

    try:
        import urllib.parse
        encoded_name = urllib.parse.quote(special_name)
        response = client.get(f"/media/{encoded_name}")
        assert response.status_code == 200
        assert len(response.content) == 2048
    finally:
        if test_file.exists():
            test_file.unlink()


def test_processor_verify_zero_byte_proxy_rejected(tmp_path):
    """Test that zero-byte proxy files fail verification"""
    zero_byte = tmp_path / "zero.mp4"
    zero_byte.write_bytes(b"")
    result = FFmpegProcessor.verify_generated_proxy(str(zero_byte))
    assert result is False


def test_processor_verify_corrupt_proxy_rejected(tmp_path):
    """Test that non-video corrupted files fail verification"""
    corrupt_file = tmp_path / "corrupt.mp4"
    corrupt_file.write_bytes(b"not a real video file content")
    result = FFmpegProcessor.verify_generated_proxy(str(corrupt_file))
    assert result is False


def test_processor_verify_nonexistent_proxy_rejected(tmp_path):
    """Test that non-existent paths fail verification"""
    fake_path = tmp_path / "does_not_exist.mp4"
    result = FFmpegProcessor.verify_generated_proxy(str(fake_path))
    assert result is False
