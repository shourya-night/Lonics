"""
Lonics Prediction Engine - Commodity Forecasting

Forecasts individual commodity-level freight demand, computes shares,
and reconciles against total freight.
"""

import numpy as np
import pandas as pd
from typing import Optional

from .config import config
from .database import FreightDatabase, get_database
from .preprocessing import get_commodity_series, extract_fiscal_year_numeric
from .features import get_commodity_display_name, compute_commodity_shares
from .forecasting import (
    ANNUAL_MODEL_CANDIDATES,
    forecast_multi_step,
    compute_prediction_interval,
)
from .evaluation import select_best_model


def forecast_commodities(
    periods: int = 3,
    db: Optional[FreightDatabase] = None,
) -> dict:
    """
    Forecast freight demand for each commodity category.
    
    Automatically discovers commodities from the database.
    Reconciles individual forecasts against the total if possible.
    
    Args:
        periods: Number of future fiscal years to forecast.
        db: Optional database instance.
    
    Returns:
        Dictionary with commodity forecasts, shares, and reconciliation info.
    """
    if db is None:
        db = get_database()
    
    commodity_df = get_commodity_series(db)
    commodity_cols = db.get_commodity_columns()
    
    if not commodity_cols:
        return {"available": False, "reason": "No commodity data in database"}
    
    # Get fiscal year info
    fiscal_years = commodity_df["fiscal_year"].values
    last_fy = fiscal_years[-1]
    
    # Generate future fiscal year labels
    forecast_periods = []
    current_fy = last_fy
    for _ in range(periods):
        current_fy = db.get_next_fiscal_year(current_fy)
        forecast_periods.append(current_fy)
    
    # Compute current shares
    latest_values = {}
    for col in commodity_cols:
        latest_values[col] = float(commodity_df[col].iloc[-1])
    
    total_latest = sum(latest_values.values())
    
    # Forecast each commodity
    commodity_forecasts = []
    total_forecast_sum = 0.0
    
    for col in commodity_cols:
        values = commodity_df[col].dropna().values
        display_name = get_commodity_display_name(col)
        
        if len(values) < 3:
            commodity_forecasts.append({
                "commodity": display_name,
                "column_name": col,
                "available": False,
                "reason": "Insufficient data",
            })
            continue
        
        # Select best model for this commodity
        min_train = min(config.model.min_train_years, len(values) - 1)
        best_name, best_metrics, all_metrics = select_best_model(
            values, ANNUAL_MODEL_CANDIDATES, min_train_size=min_train
        )
        model_fn = ANNUAL_MODEL_CANDIDATES[best_name]
        
        # Generate forecasts
        forecasts = forecast_multi_step(values, model_fn, periods=periods)
        lower, upper = compute_prediction_interval(
            values, forecasts, confidence=config.model.confidence_level
        )
        
        # Historical value (latest year)
        historical = float(values[-1])
        
        # Use first forecast period for growth calculation
        first_forecast = float(forecasts[0])
        growth = ((first_forecast - historical) / historical * 100) if historical > 0 else 0.0
        
        # Share of total (based on latest actual data)
        share = (historical / total_latest * 100) if total_latest > 0 else 0.0
        
        total_forecast_sum += first_forecast
        
        # Build forecast details for each period
        period_forecasts = []
        for i in range(periods):
            period_forecasts.append({
                "forecast_period": forecast_periods[i],
                "predicted_mt": round(float(forecasts[i]), 1),
                "lower": round(float(lower[i]), 1),
                "upper": round(float(upper[i]), 1),
            })
        
        commodity_forecasts.append({
            "commodity": display_name,
            "column_name": col,
            "available": True,
            "historical_mt": round(historical, 1),
            "forecast_mt": round(first_forecast, 1),
            "growth_percent": round(growth, 2),
            "share_percent": round(share, 2),
            "period_forecasts": period_forecasts,
            "model": best_name,
            "model_metrics": best_metrics.to_dict(),
        })
    
    # Compute forecast shares based on first period forecasts
    if total_forecast_sum > 0:
        for cf in commodity_forecasts:
            if cf.get("available", False) and "forecast_mt" in cf:
                cf["forecast_share_percent"] = round(
                    cf["forecast_mt"] / total_forecast_sum * 100, 2
                )
    
    # Reconciliation info
    reconciliation = {
        "total_latest_actual_mt": round(total_latest, 1),
        "sum_of_commodity_forecasts_mt": round(total_forecast_sum, 1),
        "note": (
            "Individual commodity forecasts are generated independently. "
            "Small discrepancies vs. total freight forecast are expected."
        ),
    }
    
    # Historical shares trend
    shares_df = compute_commodity_shares(db)
    share_cols = [c for c in shares_df.columns if c.endswith("_share_pct")]
    
    share_trends = []
    for col in commodity_cols:
        share_col = col.replace("_mt", "_share_pct")
        if share_col in shares_df.columns:
            recent_shares = shares_df[share_col].values
            if len(recent_shares) >= 2:
                share_change = float(recent_shares[-1] - recent_shares[-2])
            else:
                share_change = 0.0
            share_trends.append({
                "commodity": get_commodity_display_name(col),
                "current_share_pct": round(float(recent_shares[-1]), 2),
                "share_change_pct": round(share_change, 2),
                "trend": "INCREASING" if share_change > 0.1 else (
                    "DECREASING" if share_change < -0.1 else "STABLE"
                ),
            })
    
    return {
        "available": True,
        "commodities": commodity_forecasts,
        "reconciliation": reconciliation,
        "share_trends": share_trends,
        "latest_fiscal_year": last_fy,
        "forecast_periods": forecast_periods,
    }
