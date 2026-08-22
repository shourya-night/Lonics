"""Tests for core forecasting module."""

import sys
from pathlib import Path

engine_root = Path(__file__).parent.parent.resolve()
if str(engine_root) not in sys.path:
    sys.path.insert(0, str(engine_root))

import pytest
import numpy as np
from prediction.forecasting import (
    naive_forecast,
    linear_trend_forecast,
    recent_growth_forecast,
    holt_winters_forecast,
    seasonal_naive_forecast,
    forecast_multi_step,
    compute_prediction_interval,
    forecast_total_freight,
    forecast_monthly,
    ANNUAL_MODEL_CANDIDATES,
)
from prediction.evaluation import (
    calculate_mae,
    calculate_rmse,
    calculate_mape,
    walk_forward_backtest,
    select_best_model,
)


class TestModelFunctions:
    """Test individual forecasting model functions."""
    
    def test_naive_forecast(self):
        """Naive should return last value."""
        train = np.array([100, 110, 120, 130])
        assert naive_forecast(train) == 130
    
    def test_linear_trend_forecast(self):
        """Linear trend should extrapolate correctly."""
        # Perfect linear: 100, 110, 120, 130 -> next should be 140
        train = np.array([100, 110, 120, 130])
        pred = linear_trend_forecast(train)
        assert abs(pred - 140) < 1.0
    
    def test_recent_growth_forecast(self):
        """Recent growth should project forward."""
        train = np.array([100, 110, 121, 133.1])
        pred = recent_growth_forecast(train)
        assert pred > 133.1  # Should project growth
    
    def test_holt_winters_forecast(self):
        """Holt-Winters should produce a reasonable forecast."""
        train = np.array([100, 105, 112, 118, 125, 133, 140, 148])
        pred = holt_winters_forecast(train)
        assert pred > 140  # Should continue upward trend
        assert pred < 200  # But not unreasonably high
    
    def test_holt_winters_short_series(self):
        """Holt-Winters should fallback for short series."""
        train = np.array([100, 110])
        pred = holt_winters_forecast(train)
        assert np.isfinite(pred)
    
    def test_seasonal_naive_forecast(self):
        """Seasonal naive should repeat past season."""
        train = np.array([100, 110, 120, 130])
        pred = seasonal_naive_forecast(train, season_length=1)
        assert pred == 130  # Season=1 is same as naive


class TestMultiStepForecasting:
    """Test multi-step ahead forecasting."""
    
    def test_multi_step_linear(self):
        """Multi-step linear should produce increasing values."""
        train = np.array([100, 110, 120, 130, 140])
        forecasts = forecast_multi_step(train, linear_trend_forecast, periods=3)
        assert len(forecasts) == 3
        # Should be increasing for a linear trend
        assert all(forecasts[i] < forecasts[i+1] for i in range(len(forecasts)-1))
    
    def test_multi_step_length(self):
        """Should produce the requested number of forecasts."""
        train = np.array([100, 110, 120])
        for periods in [1, 3, 5, 10]:
            forecasts = forecast_multi_step(train, naive_forecast, periods=periods)
            assert len(forecasts) == periods


class TestPredictionIntervals:
    """Test prediction interval computation."""
    
    def test_interval_widens(self):
        """Intervals should widen over the forecast horizon."""
        train = np.array([100, 105, 110, 115, 120, 125, 130])
        forecasts = np.array([135, 140, 145])
        lower, upper = compute_prediction_interval(train, forecasts)
        
        widths = upper - lower
        assert widths[0] < widths[1] < widths[2]
    
    def test_interval_non_negative(self):
        """Lower bound should not be negative."""
        train = np.array([10, 11, 12, 13])
        forecasts = np.array([14, 15])
        lower, upper = compute_prediction_interval(train, forecasts)
        assert (lower >= 0).all()
    
    def test_interval_contains_forecast(self):
        """Forecast should be within the interval."""
        train = np.array([100, 110, 120, 130, 140])
        forecasts = np.array([150, 160])
        lower, upper = compute_prediction_interval(train, forecasts)
        assert (lower <= forecasts).all()
        assert (forecasts <= upper).all()


class TestBacktesting:
    """Test walk-forward backtesting."""
    
    def test_backtest_runs(self):
        """Backtesting should complete without errors."""
        values = np.array([100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200])
        
        def my_model(train):
            return float(train[-1])
        
        metrics = walk_forward_backtest(values, my_model, min_train_size=5)
        assert metrics is not None
        assert metrics.mae >= 0
        assert metrics.rmse >= 0
        assert metrics.mape >= 0
    
    def test_backtest_insufficient_data(self):
        """Should return None with insufficient data."""
        values = np.array([100, 110, 120])
        
        def my_model(train):
            return float(train[-1])
        
        metrics = walk_forward_backtest(values, my_model, min_train_size=10)
        assert metrics is None
    
    def test_model_selection(self):
        """Should select the best model from candidates."""
        values = np.linspace(100, 200, 20)  # Perfect linear trend
        
        best_name, best_metrics, all_metrics = select_best_model(
            values, ANNUAL_MODEL_CANDIDATES, min_train_size=8
        )
        
        assert best_name in ANNUAL_MODEL_CANDIDATES
        assert best_metrics.mape >= 0
        assert len(all_metrics) > 0


class TestMetrics:
    """Test metric calculations."""
    
    def test_mae(self):
        """MAE should be computed correctly."""
        actual = np.array([100, 200, 300])
        predicted = np.array([110, 190, 310])
        assert calculate_mae(actual, predicted) == 10.0
    
    def test_rmse(self):
        """RMSE should be >= MAE."""
        actual = np.array([100, 200, 300])
        predicted = np.array([110, 190, 310])
        assert calculate_rmse(actual, predicted) >= calculate_mae(actual, predicted)
    
    def test_mape_no_zeros(self):
        """MAPE should be computed correctly without zeros."""
        actual = np.array([100, 200, 300])
        predicted = np.array([110, 200, 300])
        mape = calculate_mape(actual, predicted)
        assert abs(mape - 3.33) < 0.1  # 10/100 = 10%, average = 3.33%
    
    def test_mape_with_zeros(self):
        """MAPE should handle zero actual values."""
        actual = np.array([0, 100, 200])
        predicted = np.array([10, 100, 200])
        mape = calculate_mape(actual, predicted)
        assert np.isfinite(mape)  # Should not be inf


class TestTotalFreightForecast:
    """Test the public forecast_total_freight function."""
    
    def test_forecast_returns_valid_structure(self):
        """Forecast should return expected structure."""
        result = forecast_total_freight(periods=3)
        
        assert "historical" in result
        assert "forecasts" in result
        assert "model" in result
        assert "model_metrics" in result
        assert "latest_actual" in result
        
        assert len(result["forecasts"]) == 3
        assert len(result["historical"]) > 0
    
    def test_forecast_values_are_dynamic(self):
        """Forecast values should not be hardcoded."""
        result = forecast_total_freight(periods=2)
        
        for fc in result["forecasts"]:
            assert fc["predicted_freight_mt"] > 0
            assert "prediction_interval" in fc
            assert fc["prediction_interval"]["lower"] > 0
            assert fc["prediction_interval"]["upper"] > fc["prediction_interval"]["lower"]
    
    def test_forecast_period_is_dynamic(self):
        """Forecast period should be computed from latest data."""
        result = forecast_total_freight(periods=1)
        
        latest_year = result["latest_actual"]["fiscal_year"]
        forecast_period = result["forecasts"][0]["forecast_period"]
        
        # The forecast period should be after the latest actual
        from prediction.database import get_database
        db = get_database()
        latest_year_num = db.get_fiscal_year_numeric(latest_year)
        forecast_year_num = db.get_fiscal_year_numeric(forecast_period)
        assert forecast_year_num == latest_year_num + 1
    
    def test_forecast_growth_calculated(self):
        """Growth percentage should be calculated."""
        result = forecast_total_freight(periods=1)
        fc = result["forecasts"][0]
        assert "growth_percent" in fc
        assert isinstance(fc["growth_percent"], float)


class TestMonthlyForecast:
    """Test monthly forecasting."""
    
    def test_monthly_forecast_available(self):
        """Monthly forecast should be available."""
        result = forecast_monthly(periods=12)
        assert result.get("available") is True
    
    def test_monthly_forecast_length(self):
        """Should return requested number of months."""
        result = forecast_monthly(periods=12)
        if result["available"]:
            assert len(result["monthly_forecast"]) == 12
    
    def test_monthly_has_seasonal_pattern(self):
        """Should include seasonal pattern information."""
        result = forecast_monthly(periods=12)
        if result["available"]:
            assert "seasonal_pattern" in result
            assert len(result["seasonal_pattern"]) == 12
    
    def test_monthly_forecast_values_positive(self):
        """Monthly forecast values should be positive."""
        result = forecast_monthly(periods=6)
        if result["available"]:
            for m in result["monthly_forecast"]:
                assert m["predicted_freight_mt"] > 0
