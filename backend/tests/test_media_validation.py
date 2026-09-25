"""Tests for media validation"""

import pytest
from pathlib import Path

from app.services.media.validator import MediaValidator


def test_validate_filename_valid():
    """Test valid filename validation"""
    is_valid, error = MediaValidator.validate_filename("video.mp4")
    assert is_valid
    assert error is None


def test_validate_filename_invalid_extension():
    """Test invalid extension rejection"""
    is_valid, error = MediaValidator.validate_filename("document.pdf")
    assert not is_valid
    assert "Invalid file extension" in error


def test_validate_filename_path_traversal():
    """Test path traversal detection"""
    is_valid, error = MediaValidator.validate_filename("../etc/passwd.mp4")
    assert not is_valid
    assert "path traversal" in error


def test_sanitize_filename():
    """Test filename sanitization"""
    safe_name = MediaValidator.sanitize_filename("My Video (2024)!.mp4")
    assert safe_name == "My_Video__2024__.mp4"


def test_validate_file_size_valid():
    """Test valid file size"""
    is_valid, error = MediaValidator.validate_file_size(100 * 1024 * 1024)  # 100 MB
    assert is_valid
    assert error is None


def test_validate_file_size_too_large():
    """Test oversized file rejection"""
    is_valid, error = MediaValidator.validate_file_size(3 * 1024 * 1024 * 1024)  # 3 GB
    assert not is_valid
    assert "exceeds maximum" in error


def test_validate_file_size_empty():
    """Test empty file rejection"""
    is_valid, error = MediaValidator.validate_file_size(0)
    assert not is_valid
    assert "empty" in error
