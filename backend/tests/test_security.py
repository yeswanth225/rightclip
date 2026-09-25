"""Tests for security validation"""

import pytest

from app.core.security import SecurityValidator


def test_validate_url_http():
    """Test HTTP URL validation"""
    is_valid, error = SecurityValidator.validate_url("http://example.com/video.mp4")
    assert is_valid
    assert error is None


def test_validate_url_https():
    """Test HTTPS URL validation"""
    is_valid, error = SecurityValidator.validate_url("https://example.com/video.mp4")
    assert is_valid
    assert error is None


def test_validate_url_localhost():
    """Test localhost blocking"""
    is_valid, error = SecurityValidator.validate_url("http://localhost/video.mp4")
    assert not is_valid
    assert "localhost" in error.lower()


def test_validate_url_private_ip():
    """Test private IP blocking"""
    is_valid, error = SecurityValidator.validate_url("http://192.168.1.1/video.mp4")
    assert not is_valid
    assert "private network" in error.lower()


def test_validate_url_loopback():
    """Test loopback blocking"""
    is_valid, error = SecurityValidator.validate_url("http://127.0.0.1/video.mp4")
    assert not is_valid
    assert "localhost" in error.lower()


def test_validate_url_invalid_scheme():
    """Test invalid scheme rejection"""
    is_valid, error = SecurityValidator.validate_url("ftp://example.com/video.mp4")
    assert not is_valid
    assert "scheme" in error.lower()


def test_validate_url_no_hostname():
    """Test URL without hostname"""
    is_valid, error = SecurityValidator.validate_url("http:///video.mp4")
    assert not is_valid
    assert "hostname" in error.lower()
