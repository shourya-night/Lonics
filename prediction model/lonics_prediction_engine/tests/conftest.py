"""
Shared test fixtures for the Lonics Prediction Engine test suite.
"""

import sys
import pytest
from pathlib import Path

# Ensure engine root is on path
engine_root = Path(__file__).parent.parent.resolve()
if str(engine_root) not in sys.path:
    sys.path.insert(0, str(engine_root))

from prediction.database import FreightDatabase


@pytest.fixture
def db():
    """Provide a FreightDatabase instance for testing."""
    return FreightDatabase()


@pytest.fixture
def db_path():
    """Provide the database path."""
    return engine_root / "railway_freight_database.sqlite"
