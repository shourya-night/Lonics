# Lonics Prediction Engine

A standalone, production-ready freight forecasting and intelligence engine for Indian Railways data. Reads from `railway_freight_database.sqlite` and produces dynamic predictions for freight demand, commodity loading, network pressure, DFC activity, and shipment-level intelligence.

---

## What It Does

The Lonics Prediction Engine provides:

1. **Total Freight Forecasting** - Annual freight demand predictions with confidence intervals
2. **Monthly Freight Forecasting** - Month-level predictions with seasonal patterns
3. **Commodity-Level Forecasting** - Auto-discovered commodity categories with individual forecasts
4. **Network Pressure Scoring** - Composite 0-100 score combining capacity, growth, trains/day, and DFC
5. **DFC Activity Forecasting** - Dedicated Freight Corridor interchange predictions
6. **Capacity Utilization Forecasting** - Network capacity outlook with pressure levels
7. **Shipment Intelligence** - Macro-level shipment scoring (rail suitability, consolidation, demand outlook)

All predictions are dynamically generated from the actual database. Nothing is hardcoded.

---

## Database Schema

The engine discovered the following schema from `railway_freight_database.sqlite`:

### `annual_overview` (21 rows, FY 2005-2006 to FY 2025-2026)
| Column | Type | Description |
|--------|------|-------------|
| fiscal_year | TEXT (PK) | e.g., "FY 2023-2024" |
| total_freight_originating_million_tonnes | REAL | Annual freight volume in MT |
| total_freight_earnings_inr_crore | REAL | Annual freight earnings in INR Crore |

### `commodity_loading` (21 rows, FY 2005-2006 to FY 2025-2026)
| Column | Type | Description |
|--------|------|-------------|
| fiscal_year | TEXT (PK) | Fiscal year |
| coal_mt | REAL | Coal loading in MT |
| iron_ore_mt | REAL | Iron Ore loading in MT |
| cement_mt | REAL | Cement loading in MT |
| containers_mt | REAL | Container loading in MT |
| foodgrains_mt | REAL | Foodgrains loading in MT |
| others_mt | REAL | Other commodities in MT |

### `golden_quadrilateral_traffic` (21 rows, FY 2005-2006 to FY 2025-2026)
| Column | Type | Description |
|--------|------|-------------|
| fiscal_year | TEXT (PK) | Fiscal year |
| network_length_share_pct | REAL | GQ share of total network (16%) |
| freight_traffic_share_pct | REAL | GQ share of freight traffic (58%) |
| avg_freight_trains_per_day | REAL | Average freight trains per day on GQ |
| avg_capacity_utilization_pct | REAL | Capacity utilization percentage |
| parallel_dfc_daily_interchanges_trains | REAL | DFC daily train interchanges |

### `monthly_trends` (36 rows, 3 fiscal years)
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER (PK) | Auto-increment ID |
| fiscal_year | TEXT | Fiscal year |
| month_number | INTEGER | Month within fiscal year (1=April, 12=March) |
| month_name | TEXT | Month name |
| monthly_originating_freight_mt | REAL | Monthly freight in MT |

### `information_sources` (4 rows)
| Column | Type | Description |
|--------|------|-------------|
| tab_name | TEXT (PK) | Data category |
| primary_data_source | TEXT | Official source name |
| official_verification_url | TEXT | Source URL |

---

## How the Model Works

### Forecasting Strategy

The engine evaluates multiple forecasting models and selects the best one via walk-forward backtesting:

| Model | Description | Best For |
|-------|-------------|----------|
| **Naive** | Repeats the last observed value | Baseline comparison |
| **Linear Trend** | Least-squares regression extrapolation | Steady growth data |
| **Recent Growth** | Average of last 3 periods' growth rates | Accelerating/decelerating trends |
| **Holt-Winters** | Exponential smoothing with damped trend | Smooth trends with uncertainty |
| **Seasonal Naive** | Repeats value from one season ago | Strong seasonal patterns |

### Why Linear Trend Was Selected

After backtesting all 5 models on 21 years of annual freight data:

| Model | MAE (MT) | RMSE (MT) | MAPE (%) | Backtests |
|-------|----------|-----------|----------|-----------|
| **linear_trend** | **10.35** | **11.86** | **0.76** | 13 |
| holt_winters | 10.40 | 13.53 | 0.79 | 13 |
| recent_growth | 17.05 | 18.91 | 1.28 | 13 |
| naive | 49.52 | 51.65 | 3.69 | 13 |
| seasonal_naive | 49.52 | 51.65 | 3.69 | 13 |

**Linear trend** achieved the lowest MAPE (0.76%), meaning predictions deviate from actual values by less than 1% on average. This is appropriate because Indian Railways freight has shown remarkably consistent linear growth over the 21-year period.

Holt-Winters performed nearly as well (0.79% MAPE) and would be competitive for future data with trend changes.

### Backtesting Methodology

Walk-forward backtesting ensures honest evaluation:

```
Train: FY 2005 through FY 2013 → Predict: FY 2014
Train: FY 2005 through FY 2014 → Predict: FY 2015
Train: FY 2005 through FY 2015 → Predict: FY 2016
...
Train: FY 2005 through FY 2024 → Predict: FY 2025
```

This produces 13 out-of-sample predictions that are compared against actual values to compute MAE, RMSE, and MAPE.

---

## Quick Start

### 1. Install Dependencies

```bash
cd lonics_prediction_engine
pip install -r requirements.txt
```

### 2. Train Models

```bash
python train_models.py
```

This runs backtesting, selects the best models, and saves them under `models/`.

### 3. Run the API

```bash
python -m uvicorn api.app:app --reload --port 8001
```

Then visit: [http://localhost:8001/docs](http://localhost:8001/docs) for interactive API docs.

### 4. Use the CLI

```bash
python predict.py freight
python predict.py monthly
python predict.py commodities
python predict.py network
python predict.py dfc
python predict.py capacity
python predict.py shipment --origin Ludhiana --destination Mumbai --commodity Containers --weight 18 --month 9
```

### 5. Run Tests

```bash
python -m pytest tests/ -v
```

---

## API Documentation

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/predictions/freight` | Total freight forecast |
| GET | `/api/predictions/monthly` | Monthly freight forecast |
| GET | `/api/predictions/commodities` | Commodity-level forecasts |
| GET | `/api/predictions/network` | Network pressure score |
| GET | `/api/predictions/dfc` | DFC activity forecast |
| GET | `/api/predictions/capacity` | Capacity utilization forecast |
| GET | `/api/predictions/model-performance` | Model evaluation metrics |
| POST | `/api/predictions/shipment` | Shipment intelligence |

### Example: Total Freight Forecast

**Request:**
```
GET /api/predictions/freight?periods=2
```

**Response:**
```json
{
  "historical": [
    {"fiscal_year": "FY 2005-2006", "freight_mt": 645.3},
    "..."
  ],
  "forecasts": [
    {
      "forecast_period": "FY 2026-2027",
      "predicted_freight_mt": 1724.8,
      "growth_percent": 3.7,
      "prediction_interval": {"lower": 1691.5, "upper": 1758.1}
    }
  ],
  "model": "linear_trend",
  "model_metrics": {"mae": 10.35, "rmse": 11.86, "mape": 0.76}
}
```

### Example: Network Pressure

**Request:**
```
GET /api/predictions/network
```

**Response:**
```json
{
  "score": 59.2,
  "level": "HIGH",
  "drivers": [
    "Capacity utilization (129.3%) is above the historical average (126.7%)",
    "Average freight trains/day (86) is 31.8% above historical average (65)",
    "DFC daily interchanges grew by 130 trains (17.4%) to 877, reducing mainline pressure"
  ],
  "components": {
    "capacity_utilization": {"score": 79.3, "weight": 0.35},
    "freight_growth": {"score": 25.6, "weight": 0.25},
    "train_density": {"score": 100.0, "weight": 0.25},
    "dfc_load": {"score": 0.0, "weight": 0.15}
  }
}
```

### Example: Shipment Intelligence

**Request:**
```
POST /api/predictions/shipment
Content-Type: application/json

{
  "origin": "Ludhiana",
  "destination": "Mumbai",
  "commodity": "Containers",
  "weight_tonnes": 18,
  "month": 9
}
```

**Response:**
```json
{
  "rail_suitability": 93.7,
  "consolidation_potential": 46.0,
  "network_pressure": 59.2,
  "demand_outlook": "VERY_HIGH",
  "recommendation": "RAIL_FEASIBLE",
  "reasons": [
    "Containers has high rail suitability (94/100) based on historical freight patterns",
    "Shipment weight (18.0t) is viable for rail but below optimal trainload (20.0t)",
    "Demand outlook is VERY_HIGH for Containers in month 9"
  ],
  "data_limitations": [
    "No route-specific historical data available",
    "No real-time congestion or delay information",
    "No shipment-level pricing data in the database"
  ]
}
```

---

## Python Interface (Direct Import)

The prediction engine also exposes a clean Python API for direct integration:

```python
from lonics_prediction_engine.prediction.forecasting import forecast_total_freight, forecast_monthly
from lonics_prediction_engine.prediction.commodity import forecast_commodities
from lonics_prediction_engine.prediction.network import calculate_network_pressure, forecast_dfc, forecast_capacity
from lonics_prediction_engine.prediction.shipment import predict_shipment

# Total freight forecast
result = forecast_total_freight(periods=5)

# Monthly forecast
monthly = forecast_monthly(periods=12)

# Commodity forecasts
commodities = forecast_commodities(periods=3)

# Network pressure
pressure = calculate_network_pressure()

# DFC forecast
dfc = forecast_dfc(periods=3)

# Capacity forecast
capacity = forecast_capacity(periods=3)

# Shipment intelligence
shipment = predict_shipment(
    origin="Ludhiana",
    destination="Mumbai",
    commodity="Containers",
    weight_tonnes=18,
    month=9,
)
```

---

## Integration Guide

### Drop-in Structure

Place the entire folder into the Lonics project root:

```
Lonics/
├── existing Lonics files...
└── lonics_prediction_engine/
    ├── api/
    ├── prediction/
    ├── models/
    ├── tests/
    ├── railway_freight_database.sqlite
    ├── train_models.py
    ├── predict.py
    └── ...
```

### Import from Lonics Backend

```python
# The prediction engine is self-contained
from lonics_prediction_engine.prediction.forecasting import forecast_total_freight
result = forecast_total_freight(periods=5)
```

### Or Run as a Microservice

```bash
cd lonics_prediction_engine
python -m uvicorn api.app:app --port 8001
```

Then call from your backend:
```python
import httpx
response = httpx.get("http://localhost:8001/api/predictions/freight")
```

---

## Project Structure

```
lonics_prediction_engine/
│
├── README.md                      # This file
├── requirements.txt               # Python dependencies
├── .gitignore                     # Git ignore rules
│
├── railway_freight_database.sqlite  # SQLite database (included)
│
├── inspect_database.py            # Database schema inspector
├── train_models.py                # Model training & backtesting script
├── predict.py                     # Command-line interface
│
├── api/
│   ├── __init__.py
│   └── app.py                     # FastAPI application (all endpoints)
│
├── prediction/
│   ├── __init__.py
│   ├── config.py                  # Centralized configuration
│   ├── database.py                # Database access layer
│   ├── preprocessing.py           # Data cleaning & transformation
│   ├── features.py                # Feature engineering
│   ├── evaluation.py              # Backtesting & metrics
│   ├── forecasting.py             # Core forecasting engine
│   ├── commodity.py               # Commodity-level forecasting
│   ├── network.py                 # Network pressure & DFC
│   └── shipment.py                # Shipment intelligence
│
├── models/                        # Saved model artifacts
│   ├── training_results.joblib
│   └── training_report.json
│
└── tests/
    ├── __init__.py
    ├── conftest.py                # Shared fixtures
    ├── test_database.py           # Database tests
    ├── test_preprocessing.py      # Preprocessing tests
    ├── test_forecasting.py        # Forecasting tests
    ├── test_commodity.py          # Commodity tests
    ├── test_network.py            # Network tests
    ├── test_shipment.py           # Shipment tests
    └── test_api.py                # API endpoint tests
```

---

## Limitations

### What the Database Contains
- ✅ 21 years of annual freight volume and earnings (FY 2005-2026)
- ✅ 6 commodity categories (Coal, Iron Ore, Cement, Containers, Foodgrains, Others)
- ✅ Golden Quadrilateral traffic metrics (trains/day, capacity utilization)
- ✅ DFC daily interchanges (from FY 2020-2021 onwards)
- ✅ 3 years of monthly freight data (FY 2023-2026)

### What the Database Does NOT Contain
- ❌ Route-level historical shipments
- ❌ Actual shipment prices or freight rates
- ❌ Individual ETA / delivery time data
- ❌ Wagon-level availability
- ❌ Real-time railway congestion data
- ❌ Station-specific throughput
- ❌ Weather or disruption data

The shipment intelligence module (`predict_shipment`) therefore provides **macro-level insights** derived from aggregate national statistics, not route-specific predictions. This is clearly documented in all responses via the `data_limitations` field.

### Model Limitations
- The dataset has only 21 annual observations, limiting the complexity of viable models
- Monthly data spans only 3 fiscal years (36 data points)
- DFC data is available from FY 2020-2021 only (6 years of non-zero data)
- Linear trend assumes continuation of historical growth patterns

---

## Configuration

All settings are centralized in `prediction/config.py`:

- Database path (relative)
- Model directory
- Forecast horizon
- Backtesting parameters
- Confidence level (default: 90%)
- Network pressure thresholds and weights
- Shipment scoring parameters

---

## License

Internal use. Part of the Lonics platform.
