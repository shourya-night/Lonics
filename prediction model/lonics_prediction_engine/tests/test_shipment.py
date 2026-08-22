"""Tests for shipment intelligence module."""

import sys
from pathlib import Path

engine_root = Path(__file__).parent.parent.resolve()
if str(engine_root) not in sys.path:
    sys.path.insert(0, str(engine_root))

import pytest
from prediction.shipment import predict_shipment


class TestShipmentPrediction:
    """Test shipment intelligence predictions."""
    
    def test_basic_shipment(self):
        """Basic shipment prediction should work."""
        result = predict_shipment(
            origin="Ludhiana",
            destination="Mumbai",
            commodity="Containers",
            weight_tonnes=18,
            month=9,
        )
        assert "error" not in result
        assert "rail_suitability" in result
        assert "consolidation_potential" in result
        assert "network_pressure" in result
        assert "demand_outlook" in result
        assert "recommendation" in result
        assert "reasons" in result
    
    def test_scores_in_range(self):
        """Scores should be between 0 and 100."""
        result = predict_shipment(
            origin="Delhi",
            destination="Chennai",
            commodity="Coal",
            weight_tonnes=50,
            month=3,
        )
        assert 0 <= result["rail_suitability"] <= 100
        assert 0 <= result["consolidation_potential"] <= 100
        assert 0 <= result["network_pressure"] <= 100
    
    def test_demand_outlook_valid(self):
        """Demand outlook should be a valid category."""
        result = predict_shipment(
            origin="Kolkata",
            destination="Jaipur",
            commodity="Iron Ore",
            weight_tonnes=30,
            month=6,
        )
        assert result["demand_outlook"] in ("LOW", "MODERATE", "HIGH", "VERY_HIGH")
    
    def test_recommendation_valid(self):
        """Recommendation should be a valid category."""
        valid_recommendations = (
            "RAIL_RECOMMENDED",
            "RAIL_WITH_CONSOLIDATION",
            "RAIL_FEASIBLE",
            "MULTIMODAL_SUGGESTED",
            "INSUFFICIENT_DATA",
        )
        result = predict_shipment(
            origin="Ahmedabad",
            destination="Bangalore",
            commodity="Cement",
            weight_tonnes=25,
            month=11,
        )
        assert result["recommendation"] in valid_recommendations
    
    def test_reasons_provided(self):
        """Reasons should be provided and non-empty."""
        result = predict_shipment(
            origin="Delhi",
            destination="Mumbai",
            commodity="Containers",
            weight_tonnes=18,
            month=9,
        )
        assert len(result["reasons"]) >= 1
        for reason in result["reasons"]:
            assert isinstance(reason, str)
            assert len(reason) > 5
    
    def test_data_limitations_documented(self):
        """Response should document data limitations."""
        result = predict_shipment(
            origin="Test",
            destination="Test",
            commodity="Coal",
            weight_tonnes=10,
            month=1,
        )
        assert "data_limitations" in result
        assert len(result["data_limitations"]) >= 1
    
    def test_invalid_weight(self):
        """Should handle invalid weight."""
        result = predict_shipment(
            origin="A",
            destination="B",
            commodity="Coal",
            weight_tonnes=-5,
            month=1,
        )
        assert "error" in result
    
    def test_invalid_month(self):
        """Should handle invalid month."""
        result = predict_shipment(
            origin="A",
            destination="B",
            commodity="Coal",
            weight_tonnes=10,
            month=13,
        )
        assert "error" in result
    
    def test_heavy_coal_shipment(self):
        """Heavy coal shipment should have high rail suitability."""
        result = predict_shipment(
            origin="Dhanbad",
            destination="Visakhapatnam",
            commodity="Coal",
            weight_tonnes=50,
            month=7,
        )
        assert result["rail_suitability"] >= 80
    
    def test_light_shipment_consolidation(self):
        """Light shipments should have high consolidation potential."""
        result = predict_shipment(
            origin="Delhi",
            destination="Mumbai",
            commodity="Containers",
            weight_tonnes=3,
            month=5,
        )
        assert result["consolidation_potential"] >= 70
    
    def test_full_trainload_low_consolidation(self):
        """Full trainload should have low consolidation potential."""
        result = predict_shipment(
            origin="Delhi",
            destination="Chennai",
            commodity="Coal",
            weight_tonnes=50,
            month=1,
        )
        assert result["consolidation_potential"] <= 30
    
    def test_different_commodities_different_scores(self):
        """Different commodities should produce different suitability scores."""
        coal = predict_shipment(
            origin="A", destination="B",
            commodity="Coal", weight_tonnes=20, month=6,
        )
        containers = predict_shipment(
            origin="A", destination="B",
            commodity="Containers", weight_tonnes=20, month=6,
        )
        # Coal and containers should have different scores
        # (they don't have to be, but our config sets them differently)
        assert coal["rail_suitability"] != containers["rail_suitability"]
    
    def test_unknown_commodity(self):
        """Unknown commodity should still return a result."""
        result = predict_shipment(
            origin="A",
            destination="B",
            commodity="ExoticMaterial",
            weight_tonnes=15,
            month=4,
        )
        assert "error" not in result
        assert result["rail_suitability"] > 0
