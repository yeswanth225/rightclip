"""Test configuration"""

import pytest


@pytest.fixture
def test_app():
    """Create test FastAPI application"""
    from app.main import app
    return app
