"""
Lonics Prediction Engine - Feature Engineering

Derives additional features from raw data to improve forecasting accuracy
and provide richer analytics.
"""

import pandas as pd
import numpy as np
from typing import Optional

from .database import FreightDatabase, get_database
from .preprocessing import (
    get_annual_freight_series,
    get_commodity_series,
    get_network_series,
    compute_cagr,
)


def compute_trend_features(ts: pd.DataFrame, value_col: str = "freight_mt") -> pd.DataFrame:
    """
    Add trend-related features to a time series.
    
    Features added:
        - rolling_avg_3: 3-year rolling average
        - rolling_avg_5: 5-year rolling average
        - yoy_growth: year-over-year growth rate
        - cagr_3: 3-year CAGR
        - cagr_5: 5-year CAGR
        - momentum: acceleration of growth
    """
    df = ts.copy()
    values = df[value_col]
    
    # Rolling averages
    df["rolling_avg_3"] = values.rolling(window=3, min_periods=1).mean()
    df["rolling_avg_5"] = values.rolling(window=5, min_periods=1).mean()
    
    # Year-over-year growth
    df["yoy_growth"] = values.pct_change()
    
    # CAGR features
    cagr_3 = []
    cagr_5 = []
    for i in range(len(values)):
        if i >= 3:
            cagr_3.append(compute_cagr(values.iloc[i-3], values.iloc[i], 3))
        else:
            cagr_3.append(np.nan)
        
        if i >= 5:
            cagr_5.append(compute_cagr(values.iloc[i-5], values.iloc[i], 5))
        else:
            cagr_5.append(np.nan)
    
    df["cagr_3"] = cagr_3
    df["cagr_5"] = cagr_5
    
    # Momentum (change in growth rate)
    df["momentum"] = df["yoy_growth"].diff()
    
    return df


def compute_seasonal_features(monthly_df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute seasonal patterns from monthly data.
    
    Features added:
        - month_avg: historical average for each month
        - seasonal_index: ratio of month average to overall average
        - deseasonalized: seasonally adjusted values
    """
    df = monthly_df.copy()
    
    if "freight_mt" not in df.columns:
        return df
    
    overall_avg = df["freight_mt"].mean()
    
    # Monthly averages
    month_avgs = df.groupby("month_number")["freight_mt"].mean()
    df["month_avg"] = df["month_number"].map(month_avgs)
    
    # Seasonal index
    if overall_avg > 0:
        df["seasonal_index"] = df["month_avg"] / overall_avg
    else:
        df["seasonal_index"] = 1.0
    
    # Deseasonalized values
    df["deseasonalized"] = df["freight_mt"] / df["seasonal_index"]
    
    return df


def compute_commodity_shares(db: Optional[FreightDatabase] = None) -> pd.DataFrame:
    """
    Compute each commodity's share of total loading.
    
    Returns DataFrame with share columns for each commodity.
    """
    if db is None:
        db = get_database()
    
    df = get_commodity_series(db)
    commodity_cols = db.get_commodity_columns()
    
    # Compute total
    df["total_loading"] = df[commodity_cols].sum(axis=1)
    
    # Compute shares
    for col in commodity_cols:
        share_col = col.replace("_mt", "_share_pct")
        df[share_col] = (df[col] / df["total_loading"] * 100).round(2)
    
    return df


def get_commodity_display_name(col_name: str) -> str:
    """
    Convert a column name like 'coal_mt' to a display name like 'Coal'.
    """
    name = col_name.replace("_mt", "").replace("_", " ")
    return name.title()


def compute_network_features(db: Optional[FreightDatabase] = None) -> pd.DataFrame:
    """
    Compute network-level features from GQ traffic data.
    
    Features added:
        - utilization_trend: direction of capacity utilization change
        - train_density_growth: growth in trains per day
        - dfc_share_growth: growth in DFC interchanges
    """
    if db is None:
        db = get_database()
    
    df = get_network_series(db)
    
    if "avg_capacity_utilization_pct" in df.columns:
        df["utilization_trend"] = df["avg_capacity_utilization_pct"].pct_change()
    
    if "avg_freight_trains_per_day" in df.columns:
        df["train_density_growth"] = df["avg_freight_trains_per_day"].pct_change()
    
    if "parallel_dfc_daily_interchanges_trains" in df.columns:
        dfc = df["parallel_dfc_daily_interchanges_trains"]
        df["dfc_active"] = (dfc > 0).astype(int)
        # Growth only where DFC was already active
        df["dfc_growth"] = dfc.pct_change().replace([np.inf, -np.inf], np.nan)
    
    return df
