"""
Lonics Prediction Engine - FastAPI Application

Standalone REST API for freight forecasting and intelligence.

Run with:
    uvicorn api.app:app --reload --port 8001
    
Or from the engine root:
    python -m uvicorn api.app:app --reload --port 8001
"""

import sys
from pathlib import Path

# Ensure the engine root is on the Python path so prediction package is importable
engine_root = Path(__file__).parent.parent.resolve()
if str(engine_root) not in sys.path:
    sys.path.insert(0, str(engine_root))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

from prediction.config import config
from prediction.database import get_database
from prediction.forecasting import forecast_total_freight, forecast_monthly
from prediction.commodity import forecast_commodities
from prediction.network import (
    calculate_network_pressure,
    forecast_dfc,
    forecast_capacity,
)
from prediction.shipment import predict_shipment


# ─── Pydantic Models ─────────────────────────────────────────────────────────

class ShipmentRequest(BaseModel):
    """Request model for shipment prediction."""
    origin: str = Field(..., description="Origin city/station", examples=["Ludhiana"])
    destination: str = Field(..., description="Destination city/station", examples=["Mumbai"])
    commodity: str = Field(..., description="Commodity type", examples=["Containers"])
    weight_tonnes: float = Field(..., gt=0, description="Shipment weight in tonnes", examples=[18])
    month: int = Field(..., ge=1, le=12, description="Calendar month (1-12)", examples=[9])


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    engine_version: str
    database_available: bool
    models_trained: bool


# ─── App Setup ────────────────────────────────────────────────────────────────

app = FastAPI(
    title=config.api.title,
    description=config.api.description,
    version=config.api.version,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Utility ─────────────────────────────────────────────────────────────────

def _check_database():
    """Verify database is accessible."""
    try:
        db = get_database()
        db.get_schema()
        return True
    except Exception:
        return False


def _check_models():
    """Check if trained models exist."""
    from prediction.forecasting import load_training_results
    return load_training_results() is not None


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Check the health of the prediction engine."""
    from prediction import __version__
    return HealthResponse(
        status="healthy",
        engine_version=__version__,
        database_available=_check_database(),
        models_trained=_check_models(),
    )


@app.get("/api/predictions/freight", tags=["Forecasting"])
async def get_freight_forecast(periods: int = 5):
    """
    Get total railway freight demand forecast.
    
    Parameters:
        periods: Number of future fiscal years to forecast (default: 5)
    """
    try:
        result = forecast_total_freight(periods=periods)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/predictions/monthly", tags=["Forecasting"])
async def get_monthly_forecast(periods: int = 12):
    """
    Get monthly freight demand forecast with seasonal patterns.
    
    Parameters:
        periods: Number of future months to forecast (default: 12)
    """
    try:
        result = forecast_monthly(periods=periods)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/predictions/commodities", tags=["Forecasting"])
async def get_commodity_forecast(periods: int = 3):
    """
    Get commodity-level freight demand forecasts.
    
    Automatically discovers all commodity categories in the database.
    
    Parameters:
        periods: Number of future fiscal years to forecast (default: 3)
    """
    try:
        result = forecast_commodities(periods=periods)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/predictions/network", tags=["Network Intelligence"])
async def get_network_pressure():
    """
    Get the Lonics Network Pressure Score and analysis.
    
    Returns a composite 0-100 score combining capacity utilization,
    freight growth, train density, and DFC activity.
    
    Note: This is a Lonics-created metric, NOT an official railway metric.
    """
    try:
        result = calculate_network_pressure()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/predictions/dfc", tags=["Network Intelligence"])
async def get_dfc_forecast(periods: int = 3):
    """
    Get Dedicated Freight Corridor activity forecast.
    
    Returns forecast only if genuine DFC data exists in the database.
    
    Parameters:
        periods: Number of future fiscal years to forecast (default: 3)
    """
    try:
        result = forecast_dfc(periods=periods)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/predictions/capacity", tags=["Network Intelligence"])
async def get_capacity_forecast(periods: int = 3):
    """
    Get capacity utilization forecast.
    
    Parameters:
        periods: Number of future fiscal years to forecast (default: 3)
    """
    try:
        result = forecast_capacity(periods=periods)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/predictions/model-performance", tags=["System"])
async def get_model_performance():
    """
    Get model performance metrics from backtesting.
    
    Returns metrics for all evaluated models, showing which model
    was selected and why.
    """
    try:
        from prediction.forecasting import load_training_results
        results = load_training_results()
        
        if results is None:
            # Run live backtesting
            result = forecast_total_freight(periods=1)
            return {
                "trained_models_available": False,
                "live_backtest": {
                    "model": result["model"],
                    "metrics": result["model_metrics"],
                    "all_models": result["all_model_metrics"],
                },
                "note": "Run train_models.py for comprehensive model evaluation"
            }
        
        return {
            "trained_models_available": True,
            "results": results,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/predictions/shipment", tags=["Shipment Intelligence"])
async def predict_shipment_endpoint(request: ShipmentRequest):
    """
    Get macro-level shipment intelligence.
    
    IMPORTANT: The database does NOT contain route-specific data.
    This endpoint provides intelligence derived from aggregate national
    freight statistics, NOT route-specific predictions.
    
    The response includes:
        - Rail suitability score (0-100)
        - Consolidation potential (0-100)
        - Network pressure (0-100)
        - Demand outlook (LOW/MODERATE/HIGH/VERY_HIGH)
        - Recommendation (RAIL_RECOMMENDED/RAIL_WITH_CONSOLIDATION/etc.)
        - Data-driven reasons
    """
    try:
        result = predict_shipment(
            origin=request.origin,
            destination=request.destination,
            commodity=request.commodity,
            weight_tonnes=request.weight_tonnes,
            month=request.month,
        )
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result)
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
