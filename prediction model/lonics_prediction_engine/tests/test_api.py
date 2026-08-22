"""Tests for the FastAPI application."""

import sys
from pathlib import Path

engine_root = Path(__file__).parent.parent.resolve()
if str(engine_root) not in sys.path:
    sys.path.insert(0, str(engine_root))

import pytest
from fastapi.testclient import TestClient
from api.app import app


@pytest.fixture
def client():
    """Provide a FastAPI test client."""
    return TestClient(app)


class TestHealthEndpoint:
    """Test the health check endpoint."""
    
    def test_health_check(self, client):
        """Health endpoint should return 200."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "engine_version" in data
        assert "database_available" in data
    
    def test_database_available(self, client):
        """Database should be available."""
        response = client.get("/health")
        data = response.json()
        assert data["database_available"] is True


class TestFreightEndpoint:
    """Test the freight forecast endpoint."""
    
    def test_freight_forecast(self, client):
        """Should return freight forecast."""
        response = client.get("/api/predictions/freight")
        assert response.status_code == 200
        data = response.json()
        assert "historical" in data
        assert "forecasts" in data
        assert "model" in data
    
    def test_freight_forecast_with_periods(self, client):
        """Should respect periods parameter."""
        response = client.get("/api/predictions/freight?periods=3")
        assert response.status_code == 200
        data = response.json()
        assert len(data["forecasts"]) == 3


class TestMonthlyEndpoint:
    """Test the monthly forecast endpoint."""
    
    def test_monthly_forecast(self, client):
        """Should return monthly forecast."""
        response = client.get("/api/predictions/monthly")
        assert response.status_code == 200
        data = response.json()
        assert data["available"] is True
    
    def test_monthly_forecast_with_periods(self, client):
        """Should respect periods parameter."""
        response = client.get("/api/predictions/monthly?periods=6")
        assert response.status_code == 200
        data = response.json()
        if data["available"]:
            assert len(data["monthly_forecast"]) == 6


class TestCommoditiesEndpoint:
    """Test the commodities endpoint."""
    
    def test_commodities_forecast(self, client):
        """Should return commodity forecasts."""
        response = client.get("/api/predictions/commodities")
        assert response.status_code == 200
        data = response.json()
        assert data["available"] is True
        assert len(data["commodities"]) >= 1


class TestNetworkEndpoint:
    """Test the network pressure endpoint."""
    
    def test_network_pressure(self, client):
        """Should return network pressure score."""
        response = client.get("/api/predictions/network")
        assert response.status_code == 200
        data = response.json()
        assert data["available"] is True
        assert 0 <= data["score"] <= 100
        assert data["level"] in ("LOW", "MODERATE", "HIGH", "CRITICAL")


class TestDFCEndpoint:
    """Test the DFC forecast endpoint."""
    
    def test_dfc_forecast(self, client):
        """Should return DFC forecast."""
        response = client.get("/api/predictions/dfc")
        assert response.status_code == 200
        data = response.json()
        assert "available" in data


class TestCapacityEndpoint:
    """Test the capacity forecast endpoint."""
    
    def test_capacity_forecast(self, client):
        """Should return capacity forecast."""
        response = client.get("/api/predictions/capacity")
        assert response.status_code == 200
        data = response.json()
        assert data["available"] is True


class TestModelPerformanceEndpoint:
    """Test the model performance endpoint."""
    
    def test_model_performance(self, client):
        """Should return model performance metrics."""
        response = client.get("/api/predictions/model-performance")
        assert response.status_code == 200
        data = response.json()
        # Should have either trained results or live backtest
        assert ("trained_models_available" in data) or ("results" in data)


class TestShipmentEndpoint:
    """Test the shipment prediction endpoint."""
    
    def test_shipment_prediction(self, client):
        """Should return shipment intelligence."""
        response = client.post(
            "/api/predictions/shipment",
            json={
                "origin": "Ludhiana",
                "destination": "Mumbai",
                "commodity": "Containers",
                "weight_tonnes": 18,
                "month": 9,
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "rail_suitability" in data
        assert "recommendation" in data
    
    def test_shipment_invalid_weight(self, client):
        """Should reject invalid weight."""
        response = client.post(
            "/api/predictions/shipment",
            json={
                "origin": "A",
                "destination": "B",
                "commodity": "Coal",
                "weight_tonnes": -5,
                "month": 1,
            }
        )
        assert response.status_code == 422  # Pydantic validation error
    
    def test_shipment_invalid_month(self, client):
        """Should reject invalid month."""
        response = client.post(
            "/api/predictions/shipment",
            json={
                "origin": "A",
                "destination": "B",
                "commodity": "Coal",
                "weight_tonnes": 10,
                "month": 15,
            }
        )
        assert response.status_code == 422
    
    def test_shipment_missing_fields(self, client):
        """Should reject missing required fields."""
        response = client.post(
            "/api/predictions/shipment",
            json={
                "origin": "A",
                "commodity": "Coal",
            }
        )
        assert response.status_code == 422
