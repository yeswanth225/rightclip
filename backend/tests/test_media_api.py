"""Tests for Media API endpoints and hardening"""

import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.media.validator import MediaValidator
from app.core.security import SecurityValidator

client = TestClient(app)


def test_upload_invalid_extension():
    """Test rejection of invalid file extensions"""
    fake_file = io.BytesIO(b"malicious executable content")
    response = client.post(
        "/api/media/upload",
        files={"file": ("virus.exe", fake_file, "application/x-msdownload")},
    )
    assert response.status_code == 400
    assert "Invalid file extension" in response.json()["detail"]


def test_upload_spoofed_mime_invalid_ext():
    """Test rejection when extension is not allowed even if mime type is spoofed"""
    fake_file = io.BytesIO(b"fake script")
    response = client.post(
        "/api/media/upload",
        files={"file": ("payload.sh", fake_file, "video/mp4")},
    )
    assert response.status_code == 400


def test_upload_empty_file():
    """Test rejection of 0-byte file"""
    empty_file = io.BytesIO(b"")
    response = client.post(
        "/api/media/upload",
        files={"file": ("empty.mp4", empty_file, "video/mp4")},
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_url_ingest_ssrf_protection_localhost():
    """Test SSRF rejection on localhost URL ingestion"""
    response = client.post(
        "/api/media/url",
        json={"url": "http://127.0.0.1:8000/secret.mp4"},
    )
    assert response.status_code == 400
    assert "localhost" in response.json()["detail"].lower()


def test_url_ingest_ssrf_protection_private_ip():
    """Test SSRF rejection on private network IPs"""
    response = client.post(
        "/api/media/url",
        json={"url": "http://192.168.1.100/video.mp4"},
    )
    assert response.status_code == 400
    assert "private" in response.json()["detail"].lower()


def test_url_ingest_invalid_scheme():
    """Test rejection of file:// and ftp:// schemes"""
    response = client.post(
        "/api/media/url",
        json={"url": "file:///etc/passwd"},
    )
    assert response.status_code == 422


def test_path_traversal_prevention_on_filename():
    """Test that path traversal in filenames is sanitized"""
    sanitized = MediaValidator.sanitize_filename("../../../malicious_video.mp4")
    assert ".." not in sanitized
    assert "/" not in sanitized
    assert "\\" not in sanitized
    assert sanitized == "malicious_video.mp4"

