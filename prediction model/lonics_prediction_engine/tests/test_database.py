"""Tests for database access layer."""

import sys
from pathlib import Path

engine_root = Path(__file__).parent.parent.resolve()
if str(engine_root) not in sys.path:
    sys.path.insert(0, str(engine_root))

import pytest
from prediction.database import FreightDatabase, get_database


class TestDatabaseConnection:
    """Test database connectivity and schema discovery."""
    
    def test_database_exists(self, db_path):
        """Database file must exist."""
        assert db_path.exists(), f"Database not found at {db_path}"
    
    def test_database_loads(self):
        """Database should load without errors."""
        db = get_database()
        assert db is not None
    
    def test_schema_discovery(self):
        """Schema should be discoverable."""
        db = get_database()
        schema = db.get_schema()
        assert isinstance(schema, dict)
        assert len(schema) > 0
    
    def test_expected_tables_exist(self):
        """Core tables should exist."""
        db = get_database()
        schema = db.get_schema()
        expected = ["annual_overview", "commodity_loading", "monthly_trends"]
        for table in expected:
            assert table in schema, f"Missing table: {table}"
    
    def test_annual_overview_loads(self):
        """Annual overview should load as DataFrame."""
        db = get_database()
        df = db.get_annual_overview()
        assert len(df) > 0
        assert "fiscal_year" in df.columns
        assert "total_freight_originating_million_tonnes" in df.columns
    
    def test_commodity_loading_loads(self):
        """Commodity loading should load as DataFrame."""
        db = get_database()
        df = db.get_commodity_loading()
        assert len(df) > 0
        assert "fiscal_year" in df.columns
    
    def test_monthly_trends_loads(self):
        """Monthly trends should load as DataFrame."""
        db = get_database()
        df = db.get_monthly_trends()
        assert len(df) > 0
        assert "month_number" in df.columns
    
    def test_golden_quadrilateral_loads(self):
        """Golden Quadrilateral data should load."""
        db = get_database()
        df = db.get_golden_quadrilateral()
        assert len(df) > 0
    
    def test_commodity_columns_discovered(self):
        """Commodity columns should be auto-discovered."""
        db = get_database()
        cols = db.get_commodity_columns()
        assert len(cols) >= 1
        assert all(c != "fiscal_year" for c in cols)
    
    def test_fiscal_year_parsing(self):
        """Fiscal year strings should parse correctly."""
        db = get_database()
        assert db.get_fiscal_year_numeric("FY 2023-2024") == 2023
        assert db.get_fiscal_year_numeric("FY 2005-2006") == 2005
    
    def test_next_fiscal_year(self):
        """Next fiscal year should be computed correctly."""
        db = get_database()
        assert db.get_next_fiscal_year("FY 2023-2024") == "FY 2024-2025"
        assert db.get_next_fiscal_year("FY 2025-2026") == "FY 2026-2027"
    
    def test_latest_fiscal_year(self):
        """Should return the most recent fiscal year."""
        db = get_database()
        latest = db.get_latest_fiscal_year()
        assert latest.startswith("FY")
        # The year should be relatively recent
        year = db.get_fiscal_year_numeric(latest)
        assert year >= 2020
    
    def test_dfc_data_check(self):
        """DFC data availability check should work."""
        db = get_database()
        result = db.has_dfc_data()
        assert isinstance(result, bool)
    
    def test_invalid_db_path(self):
        """Should raise error for invalid database path."""
        with pytest.raises(FileNotFoundError):
            FreightDatabase(Path("nonexistent.sqlite"))
    
    def test_data_sorted(self):
        """Data should be sorted by fiscal year."""
        db = get_database()
        df = db.get_annual_overview()
        years = [db.get_fiscal_year_numeric(fy) for fy in df["fiscal_year"]]
        assert years == sorted(years)
