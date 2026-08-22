import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path

# Ensure core-engine root is on path
root_dir = Path(__file__).parent.resolve()
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from main import app

client = TestClient(app)

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["database_available"] is True
    assert data["models_trained"] is True

def test_prediction_health():
    res = client.get("/api/predictions/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["database_available"] is True
    assert data["models_trained"] is True

def test_freight_forecast():
    res = client.get("/api/predictions/freight?periods=3")
    assert res.status_code == 200
    data = res.json()
    assert "historical" in data
    assert "forecasts" in data
    assert len(data["forecasts"]) == 3
    assert data["forecasts"][0]["predicted_freight_mt"] > 0
    assert "model" in data

def test_monthly_forecast():
    res = client.get("/api/predictions/monthly?periods=6")
    assert res.status_code == 200
    data = res.json()
    assert data["available"] is True
    assert "monthly_forecast" in data
    assert len(data["monthly_forecast"]) == 6
    assert "seasonal_pattern" in data
    assert data["monthly_forecast"][0]["predicted_freight_mt"] > 0

def test_commodity_forecast():
    res = client.get("/api/predictions/commodities?periods=2")
    assert res.status_code == 200
    data = res.json()
    assert "commodities" in data

def test_network_pressure():
    res = client.get("/api/predictions/network")
    assert res.status_code == 200
    data = res.json()
    assert data["available"] is True
    assert 0 <= data["score"] <= 100
    assert data["level"] in ["LOW", "MODERATE", "HIGH", "CRITICAL"]
    assert len(data["drivers"]) > 0
    assert "capacity_utilization" in data["components"]

def test_dfc_forecast():
    res = client.get("/api/predictions/dfc?periods=3")
    assert res.status_code == 200
    data = res.json()
    assert "available" in data

def test_capacity_forecast():
    res = client.get("/api/predictions/capacity?periods=2")
    assert res.status_code == 200
    data = res.json()
    assert "available" in data

def test_model_performance():
    res = client.get("/api/predictions/model-performance")
    assert res.status_code == 200
    data = res.json()
    assert "results" in data or "live_backtest" in data

def test_shipment_prediction():
    payload = {
        "origin": "Ludhiana",
        "destination": "Mumbai",
        "commodity": "Containers",
        "weight_tonnes": 18.0,
        "month": 9
    }
    res = client.post("/api/predictions/shipment", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["origin"] == "Ludhiana"
    assert data["destination"] == "Mumbai"
    assert 0 <= data["rail_suitability"] <= 100
    assert 0 <= data["consolidation_potential"] <= 100
    assert 0 <= data["network_pressure"] <= 100
    assert data["demand_outlook"] in ["LOW", "MODERATE", "HIGH", "VERY_HIGH"]
    assert "recommendation" in data
    assert len(data["reasons"]) > 0

def test_booking_with_prediction_insights():
    payload = {
        "shipper_id": "TEST-SHIPPER-01",
        "origin": "Ludhiana ICD Gate-1",
        "destination": "JNPT Port Terminal-2",
        "cargo_items": [
            {
                "package_type": "Carton",
                "length": 100,
                "width": 80,
                "height": 120,
                "quantity": 10,
                "weight_kg": 500
            }
        ],
        "commodity": "Containers",
        "rail_lock_upgrade": True
    }
    res = client.post("/api/v1/freight/book", json=payload)
    assert res.status_code in [200, 201]
    data = res.json()
    assert "booking_id" in data
    assert "final_quote" in data
    assert data["prediction_insights"] is not None
    assert "rail_suitability" in data["prediction_insights"]
