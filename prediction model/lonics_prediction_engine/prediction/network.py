"""
Lonics Prediction Engine - Network Intelligence

Computes the Lonics Network Pressure Score (0-100) and related
network-level analytics from railway capacity, traffic, and DFC data.

The Network Pressure Score is a Lonics-created composite metric,
NOT an official Indian Railways metric.
"""

import numpy as np
import pandas as pd
from typing import Optional

from .config import config
from .database import FreightDatabase, get_database
from .preprocessing import (
    get_annual_freight_series,
    get_network_series,
    normalize_series,
    compute_growth_rates,
)
from .forecasting import (
    ANNUAL_MODEL_CANDIDATES,
    forecast_multi_step,
    compute_prediction_interval,
)
from .evaluation import select_best_model


def calculate_network_pressure(
    db: Optional[FreightDatabase] = None,
) -> dict:
    """
    Calculate the Lonics Network Pressure Score.
    
    This is a composite score from 0-100 combining:
        - Capacity utilization level and trend
        - Freight demand growth
        - Train density on key corridors
        - DFC load absorption
    
    Returns:
        Dictionary with score, level, component scores, and data-driven explanations.
    """
    if db is None:
        db = get_database()
    
    network_cfg = config.network
    
    # Load data
    network_df = get_network_series(db)
    freight_df = get_annual_freight_series(db)
    
    if network_df.empty:
        return {
            "available": False,
            "reason": "No network data available in database",
        }
    
    # ─── Component 1: Capacity Utilization Score ──────────────────────
    capacity_score = 0.0
    capacity_drivers = []
    
    if "avg_capacity_utilization_pct" in network_df.columns:
        util = network_df["avg_capacity_utilization_pct"]
        current_util = float(util.iloc[-1])
        historical_avg = float(util.mean())
        historical_min = float(util.min())
        historical_max = float(util.max())
        
        # Score: how far current utilization is relative to 100% baseline
        # Utilization > 100% means over-capacity
        if current_util >= 100:
            # Scale: 100% util = 50 score, 150% util = 100 score
            capacity_score = min(100, 50 + (current_util - 100))
        else:
            # Below 100% is less pressure
            capacity_score = max(0, current_util / 2)
        
        # Generate driver explanations from actual data
        if current_util > historical_avg:
            capacity_drivers.append(
                f"Capacity utilization ({current_util:.1f}%) is above "
                f"the historical average ({historical_avg:.1f}%)"
            )
        elif current_util < historical_avg:
            capacity_drivers.append(
                f"Capacity utilization ({current_util:.1f}%) is below "
                f"the historical average ({historical_avg:.1f}%)"
            )
        
        # Trend
        if len(util) >= 3:
            recent_trend = float(util.iloc[-1] - util.iloc[-3])
            if recent_trend > 2:
                capacity_drivers.append(
                    f"Capacity utilization has increased by {recent_trend:.1f} "
                    f"percentage points over the last 3 years"
                )
            elif recent_trend < -2:
                capacity_drivers.append(
                    f"Capacity utilization has decreased by {abs(recent_trend):.1f} "
                    f"percentage points over the last 3 years"
                )
    
    # ─── Component 2: Freight Growth Pressure ─────────────────────────
    growth_score = 0.0
    growth_drivers = []
    
    if not freight_df.empty:
        freight_vals = freight_df["freight_mt"]
        recent_growth_rates = compute_growth_rates(freight_vals)
        
        # Use average of last 3 years' growth
        recent_avg_growth = float(recent_growth_rates.iloc[-3:].mean()) * 100
        overall_avg_growth = float(recent_growth_rates.dropna().mean()) * 100
        
        # Growth pressure: higher growth = more pressure on network
        # 0% growth = 0 score, 5% growth = 50 score, 10%+ = 100 score
        growth_score = min(100, max(0, recent_avg_growth * 10))
        
        if recent_avg_growth > overall_avg_growth:
            growth_drivers.append(
                f"Recent freight growth ({recent_avg_growth:.1f}% avg) exceeds "
                f"historical average ({overall_avg_growth:.1f}%)"
            )
        
        current_freight = float(freight_vals.iloc[-1])
        prev_freight = float(freight_vals.iloc[-2])
        yoy_growth = (current_freight - prev_freight) / prev_freight * 100
        
        if yoy_growth > 3:
            growth_drivers.append(
                f"Year-over-year freight demand grew {yoy_growth:.1f}% to "
                f"{current_freight:.1f} MT"
            )
        elif yoy_growth > 0:
            growth_drivers.append(
                f"Freight demand increased modestly by {yoy_growth:.1f}% to "
                f"{current_freight:.1f} MT"
            )
    
    # ─── Component 3: Train Density Score ─────────────────────────────
    density_score = 0.0
    density_drivers = []
    
    if "avg_freight_trains_per_day" in network_df.columns:
        trains = network_df["avg_freight_trains_per_day"]
        current_trains = float(trains.iloc[-1])
        historical_avg = float(trains.mean())
        
        # Normalize train density relative to range
        normalized = normalize_series(trains, "minmax")
        density_score = float(normalized.iloc[-1]) * 100
        
        if current_trains > historical_avg:
            growth_from_avg = (current_trains - historical_avg) / historical_avg * 100
            density_drivers.append(
                f"Average freight trains/day ({current_trains:.0f}) is "
                f"{growth_from_avg:.1f}% above historical average ({historical_avg:.0f})"
            )
        
        if len(trains) >= 2:
            train_growth = float(trains.iloc[-1] - trains.iloc[-2])
            if train_growth > 0:
                density_drivers.append(
                    f"Freight train frequency increased by {train_growth:.0f} "
                    f"trains/day in the latest year"
                )
    
    # ─── Component 4: DFC Load Absorption ─────────────────────────────
    dfc_score = 50.0  # Neutral default
    dfc_drivers = []
    
    if "parallel_dfc_daily_interchanges_trains" in network_df.columns:
        dfc = network_df["parallel_dfc_daily_interchanges_trains"]
        current_dfc = float(dfc.iloc[-1])
        
        if current_dfc > 0:
            # DFC absorbing load REDUCES pressure (inverse relationship)
            # Higher DFC = lower network pressure
            dfc_vals = dfc[dfc > 0]
            if len(dfc_vals) > 1:
                normalized_dfc = normalize_series(dfc_vals, "minmax")
                # Invert: high DFC = low pressure contribution
                dfc_score = (1 - float(normalized_dfc.iloc[-1])) * 100
            else:
                dfc_score = 40.0  # DFC just starting, moderate relief
            
            if len(dfc_vals) >= 2:
                dfc_growth = float(dfc_vals.iloc[-1] - dfc_vals.iloc[-2])
                dfc_growth_pct = dfc_growth / float(dfc_vals.iloc[-2]) * 100
                if dfc_growth > 0:
                    dfc_drivers.append(
                        f"DFC daily interchanges grew by {dfc_growth:.0f} trains "
                        f"({dfc_growth_pct:.1f}%) to {current_dfc:.0f}, "
                        f"reducing mainline pressure"
                    )
            
            dfc_drivers.append(
                f"Dedicated Freight Corridors handling {current_dfc:.0f} "
                f"daily train interchanges"
            )
        else:
            dfc_score = 70.0  # No DFC = higher pressure
            dfc_drivers.append(
                "DFC not yet operational, all freight on conventional network"
            )
    
    # ─── Composite Score ──────────────────────────────────────────────
    weights = network_cfg.weights
    
    composite_score = (
        capacity_score * weights["capacity_utilization"]
        + growth_score * weights["freight_growth"]
        + density_score * weights["train_density"]
        + dfc_score * weights["dfc_load"]
    )
    
    composite_score = round(min(100, max(0, composite_score)), 1)
    level = network_cfg.get_level(composite_score)
    
    # Combine all drivers
    all_drivers = capacity_drivers + growth_drivers + density_drivers + dfc_drivers
    
    return {
        "available": True,
        "score": composite_score,
        "level": level,
        "drivers": all_drivers,
        "components": {
            "capacity_utilization": {
                "score": round(capacity_score, 1),
                "weight": weights["capacity_utilization"],
            },
            "freight_growth": {
                "score": round(growth_score, 1),
                "weight": weights["freight_growth"],
            },
            "train_density": {
                "score": round(density_score, 1),
                "weight": weights["train_density"],
            },
            "dfc_load": {
                "score": round(dfc_score, 1),
                "weight": weights["dfc_load"],
            },
        },
        "note": (
            "The Lonics Network Pressure Score is a proprietary composite metric "
            "created by Lonics. It is NOT an official Indian Railways metric. "
            "It combines capacity utilization, freight growth, train density, "
            "and DFC activity into a single 0-100 score."
        ),
    }


def forecast_dfc(
    periods: int = 3,
    db: Optional[FreightDatabase] = None,
) -> dict:
    """
    Forecast Dedicated Freight Corridor activity.
    
    Returns forecast only if genuine DFC data exists in the database.
    """
    if db is None:
        db = get_database()
    
    if not db.has_dfc_data():
        return {"available": False, "reason": "No DFC data in database"}
    
    network_df = get_network_series(db)
    
    if "parallel_dfc_daily_interchanges_trains" not in network_df.columns:
        return {"available": False, "reason": "DFC column not found"}
    
    dfc_col = "parallel_dfc_daily_interchanges_trains"
    all_values = network_df[dfc_col].values
    all_years = network_df["year"].values
    fiscal_years = network_df["fiscal_year"].values
    
    # Only use non-zero values (DFC became operational partway through)
    nonzero_mask = all_values > 0
    if nonzero_mask.sum() < 2:
        return {
            "available": True,
            "current": float(all_values[-1]),
            "forecast": None,
            "note": "Insufficient DFC operational history for forecasting",
        }
    
    dfc_values = all_values[nonzero_mask]
    dfc_years = all_years[nonzero_mask]
    
    # Select model
    min_train = min(3, len(dfc_values) - 1)
    best_name, best_metrics, _ = select_best_model(
        dfc_values, ANNUAL_MODEL_CANDIDATES, min_train_size=min_train
    )
    model_fn = ANNUAL_MODEL_CANDIDATES[best_name]
    
    # Forecast
    forecasts = forecast_multi_step(dfc_values, model_fn, periods=periods)
    lower, upper = compute_prediction_interval(
        dfc_values, forecasts, confidence=config.model.confidence_level
    )
    
    current = float(dfc_values[-1])
    first_forecast = float(forecasts[0])
    growth = ((first_forecast - current) / current * 100) if current > 0 else 0.0
    
    # Trend determination
    if len(dfc_values) >= 3:
        recent_growth = (dfc_values[-1] - dfc_values[-2]) / dfc_values[-2]
        if recent_growth > 0.05:
            trend = "INCREASING"
        elif recent_growth < -0.05:
            trend = "DECREASING"
        else:
            trend = "STABLE"
    else:
        trend = "INCREASING" if growth > 0 else "STABLE"
    
    # Build forecast periods
    last_fy = fiscal_years[-1]
    forecast_periods = []
    current_fy = last_fy
    for _ in range(periods):
        current_fy = db.get_next_fiscal_year(current_fy)
        forecast_periods.append(current_fy)
    
    period_forecasts = []
    for i in range(periods):
        period_forecasts.append({
            "forecast_period": forecast_periods[i],
            "predicted_daily_interchanges": round(float(forecasts[i]), 0),
            "lower": round(float(max(0, lower[i])), 0),
            "upper": round(float(upper[i]), 0),
        })
    
    # Historical DFC data
    historical = []
    for i in range(len(all_values)):
        if all_values[i] > 0:
            historical.append({
                "fiscal_year": fiscal_years[i],
                "daily_interchanges": float(all_values[i]),
            })
    
    return {
        "available": True,
        "current": current,
        "forecast": round(first_forecast, 0),
        "growth_percent": round(growth, 2),
        "trend": trend,
        "historical": historical,
        "period_forecasts": period_forecasts,
        "model": best_name,
        "model_metrics": best_metrics.to_dict(),
        "dfc_start_year": fiscal_years[nonzero_mask][0],
    }


def forecast_capacity(
    periods: int = 3,
    db: Optional[FreightDatabase] = None,
) -> dict:
    """
    Forecast capacity utilization.
    
    Returns current and forecast utilization with pressure level assessment.
    """
    if db is None:
        db = get_database()
    
    network_df = get_network_series(db)
    
    if "avg_capacity_utilization_pct" not in network_df.columns:
        return {"available": False, "reason": "No capacity data in database"}
    
    util_col = "avg_capacity_utilization_pct"
    values = network_df[util_col].values
    years = network_df["year"].values
    fiscal_years = network_df["fiscal_year"].values
    
    # Select and apply model
    min_train = min(config.model.min_train_years, len(values) - 1)
    best_name, best_metrics, _ = select_best_model(
        values, ANNUAL_MODEL_CANDIDATES, min_train_size=min_train
    )
    model_fn = ANNUAL_MODEL_CANDIDATES[best_name]
    
    forecasts = forecast_multi_step(values, model_fn, periods=periods)
    lower, upper = compute_prediction_interval(
        values, forecasts, confidence=config.model.confidence_level
    )
    
    current = float(values[-1])
    first_forecast = float(forecasts[0])
    
    # Pressure level
    def get_pressure_level(util_pct: float) -> str:
        if util_pct >= 130:
            return "CRITICAL"
        elif util_pct >= 120:
            return "HIGH"
        elif util_pct >= 100:
            return "MODERATE"
        else:
            return "LOW"
    
    # Build forecast periods
    last_fy = fiscal_years[-1]
    forecast_periods = []
    current_fy = last_fy
    for _ in range(periods):
        current_fy = db.get_next_fiscal_year(current_fy)
        forecast_periods.append(current_fy)
    
    period_forecasts = []
    for i in range(periods):
        period_forecasts.append({
            "forecast_period": forecast_periods[i],
            "predicted_utilization_pct": round(float(forecasts[i]), 1),
            "pressure_level": get_pressure_level(forecasts[i]),
            "lower": round(float(lower[i]), 1),
            "upper": round(float(upper[i]), 1),
        })
    
    # Historical
    historical = []
    for i in range(len(values)):
        historical.append({
            "fiscal_year": fiscal_years[i],
            "utilization_pct": float(values[i]),
            "pressure_level": get_pressure_level(values[i]),
        })
    
    return {
        "available": True,
        "current_utilization_pct": round(current, 1),
        "current_pressure_level": get_pressure_level(current),
        "forecast_utilization_pct": round(first_forecast, 1),
        "forecast_pressure_level": get_pressure_level(first_forecast),
        "historical": historical,
        "period_forecasts": period_forecasts,
        "model": best_name,
        "model_metrics": best_metrics.to_dict(),
    }
