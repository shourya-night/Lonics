"""Tests for commodity forecasting module."""

import sys
from pathlib import Path

engine_root = Path(__file__).parent.parent.resolve()
if str(engine_root) not in sys.path:
    sys.path.insert(0, str(engine_root))

import pytest
from prediction.commodity import forecast_commodities
from prediction.database import get_database


class TestCommodityDiscovery:
    """Test automatic commodity detection."""
    
    def test_commodities_discovered(self):
        """Should auto-discover commodities from the database."""
        db = get_database()
        cols = db.get_commodity_columns()
        assert len(cols) >= 1
    
    def test_commodity_names_sensible(self):
        """Commodity column names should be sensible."""
        db = get_database()
        cols = db.get_commodity_columns()
        # All should end with _mt (million tonnes)
        for col in cols:
            assert col.endswith("_mt"), f"Unexpected column name: {col}"


class TestCommodityForecasting:
    """Test commodity-level forecasting."""
    
    def test_forecast_returns_commodities(self):
        """Should return forecasts for each commodity."""
        result = forecast_commodities(periods=2)
        assert result["available"] is True
        assert "commodities" in result
        assert len(result["commodities"]) >= 1
    
    def test_each_commodity_has_forecast(self):
        """Each commodity should have forecast data."""
        result = forecast_commodities(periods=1)
        for comm in result["commodities"]:
            assert "commodity" in comm
            if comm.get("available", False):
                assert "historical_mt" in comm
                assert "forecast_mt" in comm
                assert "growth_percent" in comm
                assert "share_percent" in comm
                assert "model" in comm
    
    def test_forecast_values_positive(self):
        """Forecast values should be positive."""
        result = forecast_commodities(periods=1)
        for comm in result["commodities"]:
            if comm.get("available", False):
                assert comm["forecast_mt"] > 0
                assert comm["historical_mt"] > 0
    
    def test_shares_sum_approximately_100(self):
        """Commodity shares should sum to approximately 100%."""
        result = forecast_commodities(periods=1)
        total_share = sum(
            c["share_percent"] for c in result["commodities"]
            if c.get("available", False) and "share_percent" in c
        )
        assert abs(total_share - 100) < 5, f"Shares sum to {total_share}%"
    
    def test_reconciliation_info(self):
        """Should include reconciliation information."""
        result = forecast_commodities(periods=1)
        assert "reconciliation" in result
        assert result["reconciliation"]["total_latest_actual_mt"] > 0
    
    def test_share_trends_included(self):
        """Should include share trend analysis."""
        result = forecast_commodities(periods=1)
        assert "share_trends" in result
        for trend in result["share_trends"]:
            assert "commodity" in trend
            assert "current_share_pct" in trend
            assert "trend" in trend
            assert trend["trend"] in ("INCREASING", "DECREASING", "STABLE")
    
    def test_multiple_periods(self):
        """Should support multi-period forecasting."""
        result = forecast_commodities(periods=3)
        for comm in result["commodities"]:
            if comm.get("available", False):
                assert "period_forecasts" in comm
                assert len(comm["period_forecasts"]) == 3
    
    def test_no_hardcoded_commodities(self):
        """Commodity names should come from the database, not hardcoded."""
        result = forecast_commodities(periods=1)
        commodity_names = [c["commodity"] for c in result["commodities"]]
        # Should have at least 3 different commodities
        assert len(set(commodity_names)) >= 3
