"""
Lonics Prediction Engine - Core Forecasting

Implements multiple forecasting strategies appropriate for small time-series
datasets. Includes model selection, prediction intervals, and both annual
and monthly forecasting.
"""

import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from typing import Optional
from statsmodels.tsa.holtwinters import ExponentialSmoothing

from .config import config
from .database import FreightDatabase, get_database
from .preprocessing import (
    get_annual_freight_series,
    create_monthly_time_series,
    compute_growth_rates,
)
from .evaluation import (
    ModelMetrics,
    select_best_model,
    walk_forward_backtest,
)


# ─── Model Functions ──────────────────────────────────────────────────────────
# Each function takes an array of training values and returns a single forecast.

def naive_forecast(train: np.ndarray) -> float:
    """Last-value forecast: predict the most recent observation."""
    return float(train[-1])


def linear_trend_forecast(train: np.ndarray) -> float:
    """
    Linear trend forecast using least-squares regression.
    Extrapolates the linear trend by one step.
    """
    n = len(train)
    x = np.arange(n)
    coeffs = np.polyfit(x, train, 1)
    return float(np.polyval(coeffs, n))


def recent_growth_forecast(train: np.ndarray) -> float:
    """
    Forecast based on recent growth rate.
    Uses the average growth rate of the last 3 periods.
    """
    if len(train) < 2:
        return float(train[-1])
    
    recent = train[-min(4, len(train)):]
    growth_rates = np.diff(recent) / recent[:-1]
    avg_growth = np.mean(growth_rates)
    
    return float(train[-1] * (1 + avg_growth))


def holt_winters_forecast(train: np.ndarray) -> float:
    """
    Holt-Winters exponential smoothing (no seasonality for annual data).
    Uses additive trend with damping for stability on small datasets.
    """
    if len(train) < 4:
        return linear_trend_forecast(train)
    
    try:
        model = ExponentialSmoothing(
            train,
            trend="add",
            damped_trend=True,
            seasonal=None,
        ).fit(optimized=True)
        forecast = model.forecast(1)
        return float(forecast[0])
    except Exception:
        return linear_trend_forecast(train)


def seasonal_naive_forecast(train: np.ndarray, season_length: int = 1) -> float:
    """
    Seasonal naive: repeat the value from one season ago.
    For annual data with season_length=1, this is the same as naive.
    """
    if season_length >= len(train):
        return float(train[-1])
    return float(train[-season_length])


# ─── Model Registry ──────────────────────────────────────────────────────────

ANNUAL_MODEL_CANDIDATES = {
    "naive": naive_forecast,
    "linear_trend": linear_trend_forecast,
    "recent_growth": recent_growth_forecast,
    "holt_winters": holt_winters_forecast,
    "seasonal_naive": seasonal_naive_forecast,
}


# ─── Multi-step Forecasting ──────────────────────────────────────────────────

def forecast_multi_step(
    train: np.ndarray,
    model_fn,
    periods: int = 5,
) -> np.ndarray:
    """
    Generate multi-step ahead forecasts using recursive prediction.
    
    Each step appends the prediction to the training data and
    re-forecasts for the next step.
    """
    forecasts = []
    extended = train.copy()
    
    for _ in range(periods):
        pred = model_fn(extended)
        forecasts.append(pred)
        extended = np.append(extended, pred)
    
    return np.array(forecasts)


def compute_prediction_interval(
    train: np.ndarray,
    forecasts: np.ndarray,
    confidence: float = 0.90,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Compute prediction intervals based on historical residual volatility.
    
    Uses the standard deviation of recent growth rates as a proxy for
    forecast uncertainty, widening over the forecast horizon.
    """
    # Compute residual std from recent growth
    if len(train) < 3:
        std = np.std(train) * 0.05 if len(train) > 1 else abs(train[-1] * 0.05)
    else:
        growth_rates = np.diff(train[-min(10, len(train)):]) / train[-min(10, len(train)):-1]
        std = np.std(growth_rates) * train[-1]
    
    # Z-score for confidence level
    from scipy.stats import norm
    z = norm.ppf((1 + confidence) / 2)
    
    # Widen interval over horizon
    horizons = np.arange(1, len(forecasts) + 1)
    margin = z * std * np.sqrt(horizons)
    
    lower = forecasts - margin
    upper = forecasts + margin
    
    # Ensure lower bound isn't negative for freight volumes
    lower = np.maximum(lower, 0)
    
    return lower, upper


# ─── Public API ───────────────────────────────────────────────────────────────

def forecast_total_freight(
    periods: int = 5,
    db: Optional[FreightDatabase] = None,
    model_name: Optional[str] = None,
) -> dict:
    """
    Forecast total railway freight demand.
    
    Args:
        periods: Number of future fiscal years to forecast.
        db: Optional database instance.
        model_name: Force a specific model. If None, auto-selects best.
    
    Returns:
        Dictionary with historical data, forecasts, intervals, and metrics.
    """
    if db is None:
        db = get_database()
    
    ts = get_annual_freight_series(db)
    values = ts["freight_mt"].values
    years = ts["year"].values
    fiscal_years = ts["fiscal_year"].values
    
    # Model selection via backtesting
    if model_name and model_name in ANNUAL_MODEL_CANDIDATES:
        best_model_name = model_name
        model_fn = ANNUAL_MODEL_CANDIDATES[model_name]
        # Still run backtesting for metrics
        def named_fn(train, _fn=model_fn):
            return _fn(train)
        named_fn.__name__ = model_name
        best_metrics = walk_forward_backtest(values, named_fn, min_train_size=config.model.min_train_years)
        if best_metrics is None:
            best_metrics = ModelMetrics(model=model_name, mae=0, rmse=0, mape=0, n_backtests=0)
        best_metrics.model = model_name
        all_metrics = {model_name: best_metrics}
    else:
        best_model_name, best_metrics, all_metrics = select_best_model(
            values, ANNUAL_MODEL_CANDIDATES, min_train_size=config.model.min_train_years
        )
        model_fn = ANNUAL_MODEL_CANDIDATES[best_model_name]
    
    # Generate forecasts
    forecasts = forecast_multi_step(values, model_fn, periods=periods)
    lower, upper = compute_prediction_interval(
        values, forecasts, confidence=config.model.confidence_level
    )
    
    # Build forecast periods
    last_fy = fiscal_years[-1]
    forecast_periods = []
    current_fy = last_fy
    for i in range(periods):
        current_fy = db.get_next_fiscal_year(current_fy)
        forecast_periods.append(current_fy)
    
    # Build result
    last_value = float(values[-1])
    
    forecast_details = []
    for i in range(periods):
        growth = ((forecasts[i] - last_value) / last_value * 100) if i == 0 else (
            (forecasts[i] - forecasts[i-1]) / forecasts[i-1] * 100
        )
        forecast_details.append({
            "forecast_period": forecast_periods[i],
            "predicted_freight_mt": round(float(forecasts[i]), 1),
            "growth_percent": round(float(growth), 2),
            "prediction_interval": {
                "lower": round(float(lower[i]), 1),
                "upper": round(float(upper[i]), 1),
            },
        })
    
    # Historical data
    historical = []
    for i in range(len(values)):
        historical.append({
            "fiscal_year": fiscal_years[i],
            "freight_mt": round(float(values[i]), 1),
        })
    
    return {
        "historical": historical,
        "forecasts": forecast_details,
        "latest_actual": {
            "fiscal_year": last_fy,
            "freight_mt": round(last_value, 1),
        },
        "model": best_model_name,
        "model_metrics": best_metrics.to_dict(),
        "all_model_metrics": {k: v.to_dict() for k, v in all_metrics.items()},
    }


def forecast_monthly(
    periods: int = 12,
    db: Optional[FreightDatabase] = None,
) -> dict:
    """
    Forecast monthly freight demand with seasonal patterns.
    
    Args:
        periods: Number of future months to forecast.
        db: Optional database instance.
    
    Returns:
        Dictionary with monthly forecasts and seasonal patterns.
    """
    if db is None:
        db = get_database()
    
    monthly = create_monthly_time_series(db)
    
    if monthly.empty:
        return {"available": False, "reason": "No monthly data in database"}
    
    values = monthly["freight_mt"].values
    
    # Compute seasonal indices from historical data
    month_stats = monthly.groupby("month_number")["freight_mt"].agg(["mean", "std"])
    overall_mean = values.mean()
    seasonal_indices = (month_stats["mean"] / overall_mean).to_dict()
    
    # Use Holt-Winters with seasonality if enough data
    month_names = {
        1: "April", 2: "May", 3: "June", 4: "July",
        5: "August", 6: "September", 7: "October", 8: "November",
        9: "December", 10: "January", 11: "February", 12: "March"
    }
    
    try:
        if len(values) >= 24:  # At least 2 full years
            model = ExponentialSmoothing(
                values,
                trend="add",
                damped_trend=True,
                seasonal="add",
                seasonal_periods=12,
            ).fit(optimized=True)
            forecast_vals = model.forecast(periods)
            model_used = "holt_winters_seasonal"
        else:
            # Fall back to trend + seasonal decomposition
            model = ExponentialSmoothing(
                values,
                trend="add",
                damped_trend=True,
                seasonal=None,
            ).fit(optimized=True)
            base_forecasts = model.forecast(periods)
            
            # Apply seasonal indices
            forecast_vals = np.zeros(periods)
            last_month = int(monthly["month_number"].iloc[-1])
            for i in range(periods):
                month_num = ((last_month + i) % 12) + 1
                idx = seasonal_indices.get(month_num, 1.0)
                forecast_vals[i] = base_forecasts.iloc[i] * idx / overall_mean * overall_mean
            
            model_used = "holt_winters_with_seasonal_adjustment"
    except Exception:
        # Fallback: seasonal naive with trend
        recent_year = values[-12:] if len(values) >= 12 else values
        trend = (values[-1] - values[-min(12, len(values))]) / min(12, len(values))
        forecast_vals = np.array([
            recent_year[i % len(recent_year)] + trend * (i + 1)
            for i in range(periods)
        ])
        model_used = "seasonal_naive_with_trend"
    
    # Ensure non-negative
    forecast_vals = np.maximum(forecast_vals, 0)
    
    # Compute prediction intervals
    residual_std = np.std(np.diff(values)) if len(values) > 1 else values.mean() * 0.05
    from scipy.stats import norm
    z = norm.ppf((1 + config.model.confidence_level) / 2)
    
    # Build monthly forecast list
    last_month = int(monthly["month_number"].iloc[-1])
    last_fy = monthly["fiscal_year"].iloc[-1]
    
    monthly_forecast = []
    current_fy = last_fy
    current_month = last_month
    
    for i in range(periods):
        current_month = ((last_month + i) % 12) + 1
        
        # Advance fiscal year if we wrap past March (month 12)
        if current_month == 1 and i > 0:
            current_fy = db.get_next_fiscal_year(current_fy)
        
        margin = z * residual_std * np.sqrt(i + 1)
        
        monthly_forecast.append({
            "fiscal_year": current_fy,
            "month_number": current_month,
            "month_name": month_names.get(current_month, f"Month {current_month}"),
            "predicted_freight_mt": round(float(forecast_vals[i]), 2),
            "lower": round(float(max(0, forecast_vals[i] - margin)), 2),
            "upper": round(float(forecast_vals[i] + margin), 2),
        })
    
    # Seasonal pattern summary
    seasonal_pattern = []
    for month_num in sorted(seasonal_indices.keys()):
        seasonal_pattern.append({
            "month_number": month_num,
            "month_name": month_names.get(month_num, f"Month {month_num}"),
            "seasonal_index": round(seasonal_indices[month_num], 4),
            "historical_avg_mt": round(float(month_stats.loc[month_num, "mean"]), 2),
        })
    
    return {
        "available": True,
        "monthly_forecast": monthly_forecast,
        "seasonal_pattern": seasonal_pattern,
        "model": model_used,
        "historical_months": len(values),
        "historical_years": sorted(monthly["fiscal_year"].unique().tolist()),
    }


# ─── Model Persistence ───────────────────────────────────────────────────────

def save_trained_models(db: Optional[FreightDatabase] = None) -> dict:
    """
    Train and save all models to disk.
    
    Returns a summary of trained models and their metrics.
    """
    if db is None:
        db = get_database()
    
    model_dir = config.model.model_path
    results = {}
    
    # 1. Total freight model
    ts = get_annual_freight_series(db)
    values = ts["freight_mt"].values
    
    best_name, best_metrics, all_metrics = select_best_model(
        values, ANNUAL_MODEL_CANDIDATES, min_train_size=config.model.min_train_years
    )
    
    results["total_freight"] = {
        "best_model": best_name,
        "metrics": best_metrics.to_dict(),
        "all_metrics": {k: v.to_dict() for k, v in all_metrics.items()},
    }
    
    # 2. Commodity models
    commodity_results = {}
    commodity_df = db.get_commodity_loading()
    commodity_cols = db.get_commodity_columns()
    
    from .preprocessing import extract_fiscal_year_numeric
    commodity_df = extract_fiscal_year_numeric(commodity_df)
    
    for col in commodity_cols:
        col_values = commodity_df[col].dropna().values
        if len(col_values) >= config.model.min_train_years + 1:
            c_best, c_metrics, c_all = select_best_model(
                col_values, ANNUAL_MODEL_CANDIDATES,
                min_train_size=config.model.min_train_years
            )
            commodity_results[col] = {
                "best_model": c_best,
                "metrics": c_metrics.to_dict(),
            }
    
    results["commodities"] = commodity_results
    
    # 3. Network metrics models
    network_df = get_network_series_safe(db)
    network_results = {}
    
    for col in ["avg_freight_trains_per_day", "avg_capacity_utilization_pct",
                 "parallel_dfc_daily_interchanges_trains"]:
        if col in network_df.columns:
            col_values = network_df[col].dropna().values
            # For DFC, only use non-zero values
            if "dfc" in col.lower():
                nonzero = col_values[col_values > 0]
                if len(nonzero) >= 3:
                    col_values = nonzero
                else:
                    continue
            
            if len(col_values) >= max(3, config.model.min_train_years):
                min_train = min(config.model.min_train_years, len(col_values) - 1)
                n_best, n_metrics, n_all = select_best_model(
                    col_values, ANNUAL_MODEL_CANDIDATES,
                    min_train_size=min_train
                )
                network_results[col] = {
                    "best_model": n_best,
                    "metrics": n_metrics.to_dict(),
                }
    
    results["network"] = network_results
    
    # Save results
    joblib.dump(results, model_dir / "training_results.joblib")
    
    return results


def load_training_results() -> Optional[dict]:
    """Load previously saved training results."""
    results_path = config.model.model_path / "training_results.joblib"
    if results_path.exists():
        return joblib.load(results_path)
    return None


def get_network_series_safe(db: Optional[FreightDatabase] = None) -> pd.DataFrame:
    """Safely load network series data."""
    if db is None:
        db = get_database()
    from .preprocessing import get_network_series
    return get_network_series(db)
