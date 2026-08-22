"""
Lonics Prediction Engine - Evaluation & Backtesting

Implements walk-forward backtesting and metric calculation for
model selection and performance reporting.
"""

import numpy as np
import pandas as pd
from typing import Callable
from dataclasses import dataclass, asdict


@dataclass
class ModelMetrics:
    """Performance metrics for a forecast model."""
    model: str
    mae: float
    rmse: float
    mape: float  # Percentage (e.g., 2.7 means 2.7%)
    n_backtests: int
    
    def to_dict(self) -> dict:
        return asdict(self)


def calculate_mae(actual: np.ndarray, predicted: np.ndarray) -> float:
    """Mean Absolute Error."""
    return float(np.mean(np.abs(actual - predicted)))


def calculate_rmse(actual: np.ndarray, predicted: np.ndarray) -> float:
    """Root Mean Squared Error."""
    return float(np.sqrt(np.mean((actual - predicted) ** 2)))


def calculate_mape(actual: np.ndarray, predicted: np.ndarray) -> float:
    """
    Mean Absolute Percentage Error.
    
    Returns percentage (e.g., 2.7 for 2.7%).
    Excludes zero actual values to avoid division by zero.
    """
    mask = actual != 0
    if not mask.any():
        return float("inf")
    return float(np.mean(np.abs((actual[mask] - predicted[mask]) / actual[mask])) * 100)


def walk_forward_backtest(
    values: np.ndarray,
    model_fn: Callable,
    min_train_size: int = 8,
    forecast_horizon: int = 1,
) -> ModelMetrics | None:
    """
    Perform walk-forward backtesting on a time series.
    
    For each step:
        - Train on data up to time t
        - Predict the next value(s)
        - Compare against actual
    
    Args:
        values: Array of time-series values.
        model_fn: Function(train_values) -> predicted_value (single step ahead).
        min_train_size: Minimum training set size.
        forecast_horizon: Steps ahead to predict (only 1 supported for simplicity).
    
    Returns:
        ModelMetrics with MAE, RMSE, MAPE, or None if insufficient data.
    """
    n = len(values)
    if n < min_train_size + 1:
        return None
    
    actuals = []
    predictions = []
    
    for split in range(min_train_size, n):
        train = values[:split]
        actual = values[split]
        
        try:
            predicted = model_fn(train)
            if predicted is not None and np.isfinite(predicted):
                actuals.append(actual)
                predictions.append(predicted)
        except Exception:
            continue
    
    if len(actuals) < 2:
        return None
    
    actuals = np.array(actuals)
    predictions = np.array(predictions)
    
    return ModelMetrics(
        model=model_fn.__name__ if hasattr(model_fn, '__name__') else "unknown",
        mae=round(calculate_mae(actuals, predictions), 2),
        rmse=round(calculate_rmse(actuals, predictions), 2),
        mape=round(calculate_mape(actuals, predictions), 2),
        n_backtests=len(actuals),
    )


def select_best_model(
    values: np.ndarray,
    model_candidates: dict[str, Callable],
    min_train_size: int = 8,
    metric: str = "mape",
) -> tuple[str, ModelMetrics, dict[str, ModelMetrics]]:
    """
    Select the best model from candidates using walk-forward backtesting.
    
    Args:
        values: Time-series values.
        model_candidates: Dict of model_name -> model_fn.
        min_train_size: Minimum training size for backtesting.
        metric: Metric to optimize ('mae', 'rmse', or 'mape').
    
    Returns:
        Tuple of (best_model_name, best_metrics, all_metrics_dict).
    """
    all_metrics = {}
    
    for name, fn in model_candidates.items():
        # Wrap function to carry the name
        def named_fn(train, _fn=fn):
            return _fn(train)
        named_fn.__name__ = name
        
        metrics = walk_forward_backtest(
            values, named_fn, min_train_size=min_train_size
        )
        if metrics is not None:
            metrics.model = name
            all_metrics[name] = metrics
    
    if not all_metrics:
        # Fallback: return naive if nothing works
        return "naive", ModelMetrics(
            model="naive", mae=0, rmse=0, mape=0, n_backtests=0
        ), {}
    
    # Select best by the chosen metric
    best_name = min(all_metrics, key=lambda k: getattr(all_metrics[k], metric))
    return best_name, all_metrics[best_name], all_metrics
