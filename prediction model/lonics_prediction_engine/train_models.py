#!/usr/bin/env python3
"""
Lonics Prediction Engine - Model Training Script

Trains and evaluates all forecasting models, performs backtesting,
and saves the best models to disk.

Usage:
    python train_models.py
"""

import sys
import json
import time
from pathlib import Path

# Ensure engine root is on path
engine_root = Path(__file__).parent.resolve()
if str(engine_root) not in sys.path:
    sys.path.insert(0, str(engine_root))

from prediction.config import config
from prediction.database import get_database
from prediction.forecasting import save_trained_models, ANNUAL_MODEL_CANDIDATES
from prediction.preprocessing import get_annual_freight_series, get_commodity_series
from prediction.evaluation import select_best_model


def main():
    print("=" * 70)
    print("LONICS PREDICTION ENGINE - MODEL TRAINING")
    print("=" * 70)
    
    start_time = time.time()
    
    # 1. Verify database
    print("\n[1/5] Verifying database connection...")
    try:
        db = get_database()
        schema = db.get_schema()
        print(f"  Database: {db.db_path}")
        print(f"  Tables: {', '.join(schema.keys())}")
        print(f"  Latest FY: {db.get_latest_fiscal_year()}")
    except Exception as e:
        print(f"  ERROR: {e}")
        sys.exit(1)
    
    # 2. Analyze data
    print("\n[2/5] Analyzing data...")
    ts = get_annual_freight_series(db)
    print(f"  Annual data points: {len(ts)}")
    print(f"  Date range: {ts['fiscal_year'].iloc[0]} to {ts['fiscal_year'].iloc[-1]}")
    print(f"  Freight range: {ts['freight_mt'].min():.1f} - {ts['freight_mt'].max():.1f} MT")
    
    commodity_df = get_commodity_series(db)
    commodity_cols = db.get_commodity_columns()
    print(f"  Commodities discovered: {len(commodity_cols)}")
    for col in commodity_cols:
        display = col.replace("_mt", "").replace("_", " ").title()
        print(f"    - {display}: {commodity_df[col].iloc[-1]:.1f} MT (latest)")
    
    # 3. Run backtesting
    print("\n[3/5] Running backtesting...")
    values = ts["freight_mt"].values
    
    print(f"\n  Total Freight Model Selection:")
    print(f"  {'Model':<25} {'MAE':>10} {'RMSE':>10} {'MAPE':>10} {'Backtests':>10}")
    print(f"  {'-'*25} {'-'*10} {'-'*10} {'-'*10} {'-'*10}")
    
    best_name, best_metrics, all_metrics = select_best_model(
        values, ANNUAL_MODEL_CANDIDATES,
        min_train_size=config.model.min_train_years
    )
    
    for name, metrics in sorted(all_metrics.items(), key=lambda x: x[1].mape):
        marker = " <-- BEST" if name == best_name else ""
        print(f"  {name:<25} {metrics.mae:>10.2f} {metrics.rmse:>10.2f} "
              f"{metrics.mape:>10.2f} {metrics.n_backtests:>10}{marker}")
    
    # Commodity model selection
    print(f"\n  Commodity Model Selection:")
    for col in commodity_cols:
        col_values = commodity_df[col].dropna().values
        display = col.replace("_mt", "").replace("_", " ").title()
        if len(col_values) >= config.model.min_train_years + 1:
            c_best, c_metrics, _ = select_best_model(
                col_values, ANNUAL_MODEL_CANDIDATES,
                min_train_size=config.model.min_train_years
            )
            print(f"    {display:<20} -> {c_best:<20} (MAPE: {c_metrics.mape:.2f}%)")
    
    # 4. Train and save models
    print("\n[4/5] Training final models and saving...")
    results = save_trained_models(db)
    
    model_dir = config.model.model_path
    print(f"  Models saved to: {model_dir}")
    print(f"  Total freight best model: {results['total_freight']['best_model']}")
    
    # 5. Summary
    print("\n[5/5] Training complete!")
    
    elapsed = time.time() - start_time
    
    print(f"\n{'=' * 70}")
    print(f"TRAINING SUMMARY")
    print(f"{'=' * 70}")
    print(f"  Time elapsed: {elapsed:.1f} seconds")
    print(f"  Best total freight model: {results['total_freight']['best_model']}")
    
    best = results['total_freight']['metrics']
    print(f"  Backtest metrics:")
    print(f"    MAE:  {best['mae']:.2f} MT")
    print(f"    RMSE: {best['rmse']:.2f} MT")
    print(f"    MAPE: {best['mape']:.2f}%")
    
    print(f"\n  Commodity models trained: {len(results.get('commodities', {}))}")
    print(f"  Network models trained: {len(results.get('network', {}))}")
    
    # Save human-readable results
    report_path = model_dir / "training_report.json"
    with open(report_path, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\n  Full report: {report_path}")
    
    print(f"\nDone! You can now start the API:")
    print(f"  python -m uvicorn api.app:app --reload --port 8001")


if __name__ == "__main__":
    main()
