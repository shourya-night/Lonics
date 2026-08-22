"""Tests for network intelligence module."""

import sys
from pathlib import Path

engine_root = Path(__file__).parent.parent.resolve()
if str(engine_root) not in sys.path:
    sys.path.insert(0, str(engine_root))

import pytest
from prediction.network import (
    calculate_network_pressure,
    forecast_dfc,
    forecast_capacity,
)


class TestNetworkPressure:
    """Test the Lonics Network Pressure Score."""
    
    def test_pressure_score_returned(self):
        """Should return a valid pressure score."""
        result = calculate_network_pressure()
        assert result["available"] is True
        assert "score" in result
        assert 0 <= result["score"] <= 100
    
    def test_pressure_level_valid(self):
        """Pressure level should be a valid category."""
        result = calculate_network_pressure()
        assert result["level"] in ("LOW", "MODERATE", "HIGH", "CRITICAL")
    
    def test_drivers_generated_from_data(self):
        """Drivers should be data-driven, not generic."""
        result = calculate_network_pressure()
        assert "drivers" in result
        assert len(result["drivers"]) >= 1
        # Drivers should contain specific numbers
        for driver in result["drivers"]:
            assert isinstance(driver, str)
            assert len(driver) > 10  # Not a trivial string
    
    def test_components_included(self):
        """Should include component breakdown."""
        result = calculate_network_pressure()
        assert "components" in result
        components = result["components"]
        assert "capacity_utilization" in components
        assert "freight_growth" in components
        assert "train_density" in components
        assert "dfc_load" in components
    
    def test_component_scores_valid(self):
        """Component scores should be between 0-100."""
        result = calculate_network_pressure()
        for name, comp in result["components"].items():
            assert 0 <= comp["score"] <= 100, f"{name} score out of range"
            assert 0 < comp["weight"] <= 1, f"{name} weight out of range"
    
    def test_weights_sum_to_one(self):
        """Component weights should sum to 1.0."""
        result = calculate_network_pressure()
        total_weight = sum(c["weight"] for c in result["components"].values())
        assert abs(total_weight - 1.0) < 0.01
    
    def test_disclaimer_included(self):
        """Should include disclaimer that this is not an official metric."""
        result = calculate_network_pressure()
        assert "note" in result
        assert "NOT" in result["note"] or "not" in result["note"]


class TestDFCForecast:
    """Test DFC activity forecasting."""
    
    def test_dfc_forecast_structure(self):
        """Should return valid DFC forecast structure."""
        result = forecast_dfc(periods=2)
        assert "available" in result
    
    def test_dfc_has_data(self):
        """DFC data should be available (it exists in our DB)."""
        result = forecast_dfc(periods=2)
        assert result["available"] is True
    
    def test_dfc_forecast_values(self):
        """DFC forecast should have positive values."""
        result = forecast_dfc(periods=2)
        if result["available"] and result.get("forecast") is not None:
            assert result["current"] > 0
            assert result["forecast"] > 0
            assert result["trend"] in ("INCREASING", "DECREASING", "STABLE")
    
    def test_dfc_historical(self):
        """Should include DFC historical data."""
        result = forecast_dfc(periods=2)
        if result["available"]:
            assert "historical" in result
            assert len(result["historical"]) >= 1


class TestCapacityForecast:
    """Test capacity utilization forecasting."""
    
    def test_capacity_forecast_structure(self):
        """Should return valid capacity forecast structure."""
        result = forecast_capacity(periods=2)
        assert result["available"] is True
    
    def test_capacity_current_value(self):
        """Current utilization should be a reasonable percentage."""
        result = forecast_capacity(periods=2)
        assert result["current_utilization_pct"] > 50
        assert result["current_utilization_pct"] < 200
    
    def test_pressure_level_assigned(self):
        """Pressure level should be assigned to current and forecast."""
        result = forecast_capacity(periods=2)
        valid_levels = ("LOW", "MODERATE", "HIGH", "CRITICAL")
        assert result["current_pressure_level"] in valid_levels
        assert result["forecast_pressure_level"] in valid_levels
    
    def test_capacity_historical(self):
        """Should include historical capacity data."""
        result = forecast_capacity(periods=2)
        assert "historical" in result
        assert len(result["historical"]) > 0
        for h in result["historical"]:
            assert "utilization_pct" in h
            assert "pressure_level" in h
