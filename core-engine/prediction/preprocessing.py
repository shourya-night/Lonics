"""
Lonics Prediction Engine - Data Preprocessing

Cleans and transforms raw database data into formats suitable for
time-series forecasting.
"""

import pandas as pd
import numpy as np
from typing import Optional

from .database import FreightDatabase, get_database


def extract_fiscal_year_numeric(df: pd.DataFrame, fy_col: str = "fiscal_year") -> pd.DataFrame:
    """
    Add a numeric year column from fiscal year strings.
    
    Converts 'FY 2023-2024' -> 2023 (start year) and adds as 'year' column.
    """
    df = df.copy()
    df["year"] = df[fy_col].apply(
        lambda x: int(x.replace("FY ", "").split("-")[0])
    )
    return df


def create_annual_time_series(
    values: pd.Series,
    years: pd.Series,
    name: str = "value"
) -> pd.DataFrame:
    """
    Create a clean annual time series DataFrame.
    
    Args:
        values: The numeric values.
        years: The corresponding years (numeric).
        name: Column name for the values.
    
    Returns:
        DataFrame with 'year' and the named value column, sorted by year.
    """
    ts = pd.DataFrame({"year": years, name: values})
    ts = ts.sort_values("year").reset_index(drop=True)
    ts = ts.dropna(subset=[name])
    return ts


def create_monthly_time_series(db: Optional[FreightDatabase] = None) -> pd.DataFrame:
    """
    Create a monthly time series from the monthly_trends table.
    
    Assigns a sequential period index for modeling.
    Indian fiscal year: April (month 1) to March (month 12).
    
    Returns:
        DataFrame with columns: fiscal_year, month_number, month_name,
        freight_mt, year, period_index
    """
    if db is None:
        db = get_database()
    
    df = db.get_monthly_trends()
    df = extract_fiscal_year_numeric(df)
    
    # Create a sequential period index for time-series modeling
    df = df.sort_values(["year", "month_number"]).reset_index(drop=True)
    df["period_index"] = range(len(df))
    
    # Rename for consistency
    if "monthly_originating_freight_mt" in df.columns:
        df = df.rename(columns={"monthly_originating_freight_mt": "freight_mt"})
    
    return df


def compute_growth_rates(values: pd.Series) -> pd.Series:
    """
    Compute period-over-period growth rates.
    
    Returns growth as a fraction (0.05 = 5% growth).
    """
    return values.pct_change()


def compute_cagr(start_value: float, end_value: float, periods: int) -> float:
    """
    Compute Compound Annual Growth Rate.
    
    Returns CAGR as a fraction.
    """
    if start_value <= 0 or periods <= 0:
        return 0.0
    return (end_value / start_value) ** (1 / periods) - 1


def handle_missing_values(df: pd.DataFrame, method: str = "interpolate") -> pd.DataFrame:
    """
    Handle missing values in a DataFrame.
    
    Args:
        df: Input DataFrame.
        method: 'interpolate', 'ffill', 'bfill', or 'drop'.
    
    Returns:
        DataFrame with missing values handled.
    """
    df = df.copy()
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    
    if method == "interpolate":
        df[numeric_cols] = df[numeric_cols].interpolate(method="linear")
        # Fill any remaining NaN at edges
        df[numeric_cols] = df[numeric_cols].bfill().ffill()
    elif method == "ffill":
        df[numeric_cols] = df[numeric_cols].ffill()
    elif method == "bfill":
        df[numeric_cols] = df[numeric_cols].bfill()
    elif method == "drop":
        df = df.dropna(subset=numeric_cols)
    
    return df


def normalize_series(values: pd.Series, method: str = "minmax") -> pd.Series:
    """
    Normalize a numeric series.
    
    Args:
        values: Input series.
        method: 'minmax' (0-1) or 'zscore'.
    
    Returns:
        Normalized series.
    """
    if method == "minmax":
        vmin = values.min()
        vmax = values.max()
        if vmax == vmin:
            return pd.Series(0.5, index=values.index)
        return (values - vmin) / (vmax - vmin)
    elif method == "zscore":
        mean = values.mean()
        std = values.std()
        if std == 0:
            return pd.Series(0.0, index=values.index)
        return (values - mean) / std
    else:
        raise ValueError(f"Unknown normalization method: {method}")


def get_annual_freight_series(db: Optional[FreightDatabase] = None) -> pd.DataFrame:
    """
    Get a clean annual freight time series ready for modeling.
    
    Returns:
        DataFrame with columns: year, freight_mt, earnings_crore, growth_rate
    """
    if db is None:
        db = get_database()
    
    df = db.get_annual_overview()
    df = extract_fiscal_year_numeric(df)
    
    ts = pd.DataFrame({
        "year": df["year"],
        "fiscal_year": df["fiscal_year"],
        "freight_mt": df["total_freight_originating_million_tonnes"],
        "earnings_crore": df["total_freight_earnings_inr_crore"],
    })
    
    ts = ts.sort_values("year").reset_index(drop=True)
    ts["growth_rate"] = compute_growth_rates(ts["freight_mt"])
    
    return ts


def get_commodity_series(db: Optional[FreightDatabase] = None) -> pd.DataFrame:
    """
    Get clean commodity loading time series.
    
    Returns:
        DataFrame with year column and one column per commodity.
    """
    if db is None:
        db = get_database()
    
    df = db.get_commodity_loading()
    df = extract_fiscal_year_numeric(df)
    df = df.sort_values("year").reset_index(drop=True)
    
    return df


def get_network_series(db: Optional[FreightDatabase] = None) -> pd.DataFrame:
    """
    Get clean network/GQ traffic time series.
    
    Returns:
        DataFrame with year and network metrics columns.
    """
    if db is None:
        db = get_database()
    
    df = db.get_golden_quadrilateral()
    df = extract_fiscal_year_numeric(df)
    df = df.sort_values("year").reset_index(drop=True)
    
    return df
