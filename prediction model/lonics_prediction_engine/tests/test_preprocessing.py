"""Tests for data preprocessing module."""

import sys
from pathlib import Path

engine_root = Path(__file__).parent.parent.resolve()
if str(engine_root) not in sys.path:
    sys.path.insert(0, str(engine_root))

import pytest
import numpy as np
import pandas as pd
from prediction.preprocessing import (
    extract_fiscal_year_numeric,
    create_annual_time_series,
    create_monthly_time_series,
    compute_growth_rates,
    compute_cagr,
    handle_missing_values,
    normalize_series,
    get_annual_freight_series,
    get_commodity_series,
    get_network_series,
)


class TestFiscalYearExtraction:
    """Test fiscal year parsing."""
    
    def test_standard_format(self):
        """Standard FY format should parse correctly."""
        df = pd.DataFrame({"fiscal_year": ["FY 2020-2021", "FY 2021-2022"]})
        result = extract_fiscal_year_numeric(df)
        assert list(result["year"]) == [2020, 2021]
    
    def test_preserves_original_columns(self):
        """Original columns should be preserved."""
        df = pd.DataFrame({"fiscal_year": ["FY 2020-2021"], "value": [100]})
        result = extract_fiscal_year_numeric(df)
        assert "value" in result.columns
        assert "fiscal_year" in result.columns


class TestGrowthCalculations:
    """Test growth rate computations."""
    
    def test_basic_growth(self):
        """Growth rates should be computed correctly."""
        values = pd.Series([100, 110, 121])
        growth = compute_growth_rates(values)
        assert np.isnan(growth.iloc[0])
        assert abs(growth.iloc[1] - 0.10) < 0.01
        assert abs(growth.iloc[2] - 0.10) < 0.01
    
    def test_negative_growth(self):
        """Negative growth should be handled."""
        values = pd.Series([100, 90])
        growth = compute_growth_rates(values)
        assert growth.iloc[1] < 0
    
    def test_cagr(self):
        """CAGR should be computed correctly."""
        # 100 -> 200 over 7 years ~= 10.4% CAGR
        cagr = compute_cagr(100, 200, 7)
        assert abs(cagr - 0.1041) < 0.001
    
    def test_cagr_zero_start(self):
        """CAGR with zero start should return 0."""
        assert compute_cagr(0, 100, 5) == 0.0
    
    def test_cagr_zero_periods(self):
        """CAGR with zero periods should return 0."""
        assert compute_cagr(100, 200, 0) == 0.0


class TestMissingValues:
    """Test missing value handling."""
    
    def test_interpolation(self):
        """Interpolation should fill NaN values."""
        df = pd.DataFrame({"value": [1.0, np.nan, 3.0]})
        result = handle_missing_values(df, method="interpolate")
        assert not result["value"].isna().any()
        assert abs(result["value"].iloc[1] - 2.0) < 0.01
    
    def test_ffill(self):
        """Forward fill should propagate last value."""
        df = pd.DataFrame({"value": [1.0, np.nan, np.nan]})
        result = handle_missing_values(df, method="ffill")
        assert result["value"].iloc[1] == 1.0
    
    def test_drop(self):
        """Drop should remove rows with NaN."""
        df = pd.DataFrame({"value": [1.0, np.nan, 3.0]})
        result = handle_missing_values(df, method="drop")
        assert len(result) == 2


class TestNormalization:
    """Test normalization methods."""
    
    def test_minmax(self):
        """Min-max normalization should produce 0-1 range."""
        values = pd.Series([10, 20, 30, 40, 50])
        result = normalize_series(values, method="minmax")
        assert result.min() == 0.0
        assert result.max() == 1.0
    
    def test_minmax_constant(self):
        """Constant values should normalize to 0.5."""
        values = pd.Series([5, 5, 5])
        result = normalize_series(values, method="minmax")
        assert (result == 0.5).all()
    
    def test_zscore(self):
        """Z-score normalization should have ~0 mean and ~1 std."""
        values = pd.Series([10, 20, 30, 40, 50])
        result = normalize_series(values, method="zscore")
        assert abs(result.mean()) < 0.01
        assert abs(result.std() - 1.0) < 0.01


class TestDataLoading:
    """Test actual data loading from the database."""
    
    def test_annual_freight_series(self):
        """Annual freight series should load correctly."""
        ts = get_annual_freight_series()
        assert len(ts) > 0
        assert "year" in ts.columns
        assert "freight_mt" in ts.columns
        assert "growth_rate" in ts.columns
        assert ts["freight_mt"].min() > 0
    
    def test_commodity_series(self):
        """Commodity series should load correctly."""
        df = get_commodity_series()
        assert len(df) > 0
        assert "year" in df.columns
    
    def test_network_series(self):
        """Network series should load correctly."""
        df = get_network_series()
        assert len(df) > 0
        assert "year" in df.columns
    
    def test_monthly_time_series(self):
        """Monthly time series should be created correctly."""
        ts = create_monthly_time_series()
        assert len(ts) > 0
        assert "freight_mt" in ts.columns
        assert "month_number" in ts.columns
        assert "period_index" in ts.columns
