#!/usr/bin/env python3
"""
Lonics Prediction Engine - Command-Line Interface

Usage:
    python predict.py freight [--periods N]
    python predict.py monthly [--periods N]
    python predict.py commodities [--periods N]
    python predict.py network
    python predict.py dfc [--periods N]
    python predict.py capacity [--periods N]
    python predict.py shipment --origin ORIGIN --destination DEST --commodity COMM --weight W --month M
"""

import sys
import json
import argparse
from pathlib import Path

# Ensure engine root is on path
engine_root = Path(__file__).parent.resolve()
if str(engine_root) not in sys.path:
    sys.path.insert(0, str(engine_root))


def cmd_freight(args):
    """Forecast total freight."""
    from prediction.forecasting import forecast_total_freight
    result = forecast_total_freight(periods=args.periods)
    print(json.dumps(result, indent=2))


def cmd_monthly(args):
    """Forecast monthly freight."""
    from prediction.forecasting import forecast_monthly
    result = forecast_monthly(periods=args.periods)
    print(json.dumps(result, indent=2))


def cmd_commodities(args):
    """Forecast commodity freight."""
    from prediction.commodity import forecast_commodities
    result = forecast_commodities(periods=args.periods)
    print(json.dumps(result, indent=2))


def cmd_network(args):
    """Calculate network pressure."""
    from prediction.network import calculate_network_pressure
    result = calculate_network_pressure()
    print(json.dumps(result, indent=2))


def cmd_dfc(args):
    """Forecast DFC activity."""
    from prediction.network import forecast_dfc
    result = forecast_dfc(periods=args.periods)
    print(json.dumps(result, indent=2))


def cmd_capacity(args):
    """Forecast capacity utilization."""
    from prediction.network import forecast_capacity
    result = forecast_capacity(periods=args.periods)
    print(json.dumps(result, indent=2))


def cmd_shipment(args):
    """Predict shipment intelligence."""
    from prediction.shipment import predict_shipment
    result = predict_shipment(
        origin=args.origin,
        destination=args.destination,
        commodity=args.commodity,
        weight_tonnes=args.weight,
        month=args.month,
    )
    print(json.dumps(result, indent=2))


def cmd_model_performance(args):
    """Show model performance metrics."""
    from prediction.forecasting import load_training_results, forecast_total_freight
    
    results = load_training_results()
    if results:
        print(json.dumps(results, indent=2, default=str))
    else:
        print("No trained models found. Running live backtesting...")
        result = forecast_total_freight(periods=1)
        perf = {
            "model": result["model"],
            "metrics": result["model_metrics"],
            "all_models": result["all_model_metrics"],
        }
        print(json.dumps(perf, indent=2))


def main():
    parser = argparse.ArgumentParser(
        description="Lonics Prediction Engine CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python predict.py freight
  python predict.py monthly --periods 24
  python predict.py commodities
  python predict.py network
  python predict.py dfc
  python predict.py capacity
  python predict.py shipment --origin Ludhiana --destination Mumbai --commodity Containers --weight 18 --month 9
  python predict.py model-performance
        """
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Prediction command")
    
    # Freight
    p_freight = subparsers.add_parser("freight", help="Total freight forecast")
    p_freight.add_argument("--periods", type=int, default=5, help="Forecast periods (years)")
    p_freight.set_defaults(func=cmd_freight)
    
    # Monthly
    p_monthly = subparsers.add_parser("monthly", help="Monthly freight forecast")
    p_monthly.add_argument("--periods", type=int, default=12, help="Forecast periods (months)")
    p_monthly.set_defaults(func=cmd_monthly)
    
    # Commodities
    p_comm = subparsers.add_parser("commodities", help="Commodity freight forecast")
    p_comm.add_argument("--periods", type=int, default=3, help="Forecast periods (years)")
    p_comm.set_defaults(func=cmd_commodities)
    
    # Network
    p_net = subparsers.add_parser("network", help="Network pressure analysis")
    p_net.set_defaults(func=cmd_network)
    
    # DFC
    p_dfc = subparsers.add_parser("dfc", help="DFC activity forecast")
    p_dfc.add_argument("--periods", type=int, default=3, help="Forecast periods (years)")
    p_dfc.set_defaults(func=cmd_dfc)
    
    # Capacity
    p_cap = subparsers.add_parser("capacity", help="Capacity utilization forecast")
    p_cap.add_argument("--periods", type=int, default=3, help="Forecast periods (years)")
    p_cap.set_defaults(func=cmd_capacity)
    
    # Shipment
    p_ship = subparsers.add_parser("shipment", help="Shipment intelligence")
    p_ship.add_argument("--origin", required=True, help="Origin city/station")
    p_ship.add_argument("--destination", required=True, help="Destination city/station")
    p_ship.add_argument("--commodity", required=True, help="Commodity type")
    p_ship.add_argument("--weight", type=float, required=True, help="Weight in tonnes")
    p_ship.add_argument("--month", type=int, required=True, help="Calendar month (1-12)")
    p_ship.set_defaults(func=cmd_shipment)
    
    # Model performance
    p_perf = subparsers.add_parser("model-performance", help="Show model metrics")
    p_perf.set_defaults(func=cmd_model_performance)
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    args.func(args)


if __name__ == "__main__":
    main()
