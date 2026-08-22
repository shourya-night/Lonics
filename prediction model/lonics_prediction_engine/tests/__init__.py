"""
Lonics Prediction Engine - Tests Package

Shared fixtures and configuration for the test suite.
"""

import sys
from pathlib import Path

# Ensure engine root is on path
engine_root = Path(__file__).parent.parent.resolve()
if str(engine_root) not in sys.path:
    sys.path.insert(0, str(engine_root))
