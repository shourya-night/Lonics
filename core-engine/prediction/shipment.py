"""
Lonics Prediction Engine - Shipment Intelligence

Provides macro-level shipment predictions based on available database metrics.

IMPORTANT: The database does NOT contain route-specific data, shipment prices,
individual ETAs, wagon availability, or real-time congestion data. Therefore,
this module provides macro-level intelligence derived from aggregate freight
statistics, NOT route-specific predictions.
"""

import numpy as np
from typing import Optional

from .config import config
from .database import FreightDatabase, get_database
from .preprocessing import (
    get_annual_freight_series,
    get_commodity_series,
    get_network_series,
    compute_growth_rates,
    normalize_series,
)
from .network import calculate_network_pressure


# Month names mapping (Indian fiscal year)
FISCAL_MONTH_NAMES = {
    1: "April", 2: "May", 3: "June", 4: "July",
    5: "August", 6: "September", 7: "October", 8: "November",
    9: "December", 10: "January", 11: "February", 12: "March",
}

# Calendar month to fiscal month mapping
CALENDAR_TO_FISCAL = {
    4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 6,
    10: 7, 11: 8, 12: 9, 1: 10, 2: 11, 3: 12,
}


def predict_shipment(
    origin: str,
    destination: str,
    commodity: str,
    weight_tonnes: float,
    month: int,
    db: Optional[FreightDatabase] = None,
) -> dict:
    """
    Provide macro-level shipment intelligence.
    
    This function does NOT predict exact routes, ETAs, prices, or
    wagon availability, as the database does not contain that data.
    
    Instead, it provides:
        - Rail suitability score (0-100) based on commodity type and weight
        - Consolidation potential based on weight efficiency
        - Network pressure based on current system load
        - Demand outlook based on seasonal and commodity trends
        - Recommendation based on all factors
    
    Args:
        origin: Origin city/station (used for context, not route-specific)
        destination: Destination city/station (used for context, not route-specific)
        commodity: Commodity type (e.g., 'Containers', 'Coal')
        weight_tonnes: Shipment weight in tonnes
        month: Calendar month number (1-12)
    
    Returns:
        Dictionary with macro-level shipment intelligence.
    """
    if db is None:
        db = get_database()
    
    # ─── Validate inputs ──────────────────────────────────────────────
    if weight_tonnes <= 0:
        return {
            "error": "INVALID_INPUT",
            "reason": "Weight must be positive",
        }
    
    if month < 1 or month > 12:
        return {
            "error": "INVALID_INPUT",
            "reason": "Month must be between 1 and 12",
        }
    
    # ─── 1. Rail Suitability Score ────────────────────────────────────
    rail_suitability = _compute_rail_suitability(commodity, weight_tonnes, db)
    
    # ─── 2. Consolidation Potential ───────────────────────────────────
    consolidation = _compute_consolidation_potential(weight_tonnes, commodity)
    
    # ─── 3. Network Pressure ─────────────────────────────────────────
    pressure_result = calculate_network_pressure(db)
    network_pressure = pressure_result.get("score", 50.0) if pressure_result.get("available") else 50.0
    
    # ─── 4. Demand Outlook ────────────────────────────────────────────
    demand_outlook = _compute_demand_outlook(commodity, month, db)
    
    # ─── 5. Recommendation ───────────────────────────────────────────
    recommendation, reasons = _generate_recommendation(
        rail_suitability=rail_suitability,
        consolidation=consolidation,
        network_pressure=network_pressure,
        demand_outlook=demand_outlook,
        commodity=commodity,
        weight_tonnes=weight_tonnes,
        month=month,
        origin=origin,
        destination=destination,
        db=db,
    )
    
    return {
        "origin": origin,
        "destination": destination,
        "commodity": commodity,
        "weight_tonnes": weight_tonnes,
        "month": month,
        "rail_suitability": round(rail_suitability, 1),
        "consolidation_potential": round(consolidation, 1),
        "network_pressure": round(network_pressure, 1),
        "demand_outlook": demand_outlook,
        "recommendation": recommendation,
        "reasons": reasons,
        "data_limitations": [
            "No route-specific historical data available",
            "No real-time congestion or delay information",
            "No shipment-level pricing data in the database",
            "No wagon availability or scheduling data",
            "Scores are derived from macro-level national freight statistics",
        ],
    }


def _compute_rail_suitability(
    commodity: str,
    weight_tonnes: float,
    db: FreightDatabase,
) -> float:
    """
    Compute rail suitability score (0-100).
    
    Based on:
        - Commodity type (some commodities are better suited for rail)
        - Weight (heavier shipments favor rail)
        - Historical commodity growth trend
    """
    shipment_cfg = config.shipment
    
    # Base score from commodity type
    commodity_lower = commodity.lower().replace(" ", "_")
    base_score = shipment_cfg.commodity_suitability.get(commodity_lower, 70)
    
    # Also check partial matches
    if base_score == 70:  # default
        for key, score in shipment_cfg.commodity_suitability.items():
            if key in commodity_lower or commodity_lower in key:
                base_score = score
                break
    
    # Weight adjustment
    if weight_tonnes >= shipment_cfg.optimal_rail_weight_tonnes:
        weight_bonus = 10  # Full trainload, ideal for rail
    elif weight_tonnes >= shipment_cfg.min_rail_weight_tonnes:
        # Scale linearly between min and optimal
        ratio = (weight_tonnes - shipment_cfg.min_rail_weight_tonnes) / (
            shipment_cfg.optimal_rail_weight_tonnes - shipment_cfg.min_rail_weight_tonnes
        )
        weight_bonus = ratio * 10
    else:
        # Below minimum, penalize
        weight_bonus = -15
    
    # Commodity growth trend adjustment
    try:
        commodity_df = get_commodity_series(db)
        commodity_cols = db.get_commodity_columns()
        
        # Find matching column
        matching_col = None
        for col in commodity_cols:
            if commodity_lower in col.lower() or col.lower().replace("_mt", "") in commodity_lower:
                matching_col = col
                break
        
        if matching_col and len(commodity_df) >= 3:
            values = commodity_df[matching_col].values
            recent_growth = (values[-1] - values[-3]) / values[-3] * 100
            if recent_growth > 5:
                growth_bonus = 5  # Strong growth = infrastructure investment
            elif recent_growth > 0:
                growth_bonus = 2
            else:
                growth_bonus = -3  # Declining commodity
        else:
            growth_bonus = 0
    except Exception:
        growth_bonus = 0
    
    score = base_score + weight_bonus + growth_bonus
    return max(0, min(100, score))


def _compute_consolidation_potential(
    weight_tonnes: float,
    commodity: str,
) -> float:
    """
    Compute consolidation potential score (0-100).
    
    Higher score = more potential benefit from consolidating with other shipments.
    """
    threshold = config.shipment.consolidation_weight_threshold
    optimal = config.shipment.optimal_rail_weight_tonnes
    
    if weight_tonnes >= optimal:
        # Already a full load, no consolidation needed
        return 20.0
    
    if weight_tonnes < threshold:
        # High consolidation potential
        ratio = 1 - (weight_tonnes / threshold)
        return min(100, 70 + ratio * 30)
    
    # Between threshold and optimal
    ratio = 1 - ((weight_tonnes - threshold) / (optimal - threshold))
    return 30 + ratio * 40
    

def _compute_demand_outlook(
    commodity: str,
    month: int,
    db: FreightDatabase,
) -> str:
    """
    Determine demand outlook based on seasonal and commodity trends.
    
    Returns: 'LOW', 'MODERATE', 'HIGH', or 'VERY_HIGH'
    """
    demand_score = 50.0  # Neutral start
    
    # 1. Check seasonal pattern from monthly data
    try:
        monthly_df = db.get_monthly_trends()
        if not monthly_df.empty:
            fiscal_month = CALENDAR_TO_FISCAL.get(month, month)
            
            month_data = monthly_df[monthly_df["month_number"] == fiscal_month]
            if not month_data.empty:
                month_avg = month_data["monthly_originating_freight_mt"].mean()
                overall_avg = monthly_df["monthly_originating_freight_mt"].mean()
                
                if month_avg > overall_avg * 1.05:
                    demand_score += 15  # Above average month
                elif month_avg < overall_avg * 0.95:
                    demand_score -= 10  # Below average month
    except Exception:
        pass
    
    # 2. Check commodity trend
    try:
        commodity_df = get_commodity_series(db)
        commodity_cols = db.get_commodity_columns()
        commodity_lower = commodity.lower().replace(" ", "_")
        
        matching_col = None
        for col in commodity_cols:
            if commodity_lower in col.lower() or col.lower().replace("_mt", "") in commodity_lower:
                matching_col = col
                break
        
        if matching_col and len(commodity_df) >= 2:
            values = commodity_df[matching_col].values
            yoy_growth = (values[-1] - values[-2]) / values[-2] * 100
            
            if yoy_growth > 5:
                demand_score += 20
            elif yoy_growth > 2:
                demand_score += 10
            elif yoy_growth < -2:
                demand_score -= 15
    except Exception:
        pass
    
    # 3. Check overall freight trend
    try:
        freight_df = get_annual_freight_series(db)
        if len(freight_df) >= 2:
            values = freight_df["freight_mt"].values
            yoy_growth = (values[-1] - values[-2]) / values[-2] * 100
            if yoy_growth > 3:
                demand_score += 10
            elif yoy_growth > 0:
                demand_score += 5
    except Exception:
        pass
    
    # Map score to outlook
    if demand_score >= 75:
        return "VERY_HIGH"
    elif demand_score >= 60:
        return "HIGH"
    elif demand_score >= 40:
        return "MODERATE"
    else:
        return "LOW"


def _generate_recommendation(
    rail_suitability: float,
    consolidation: float,
    network_pressure: float,
    demand_outlook: str,
    commodity: str,
    weight_tonnes: float,
    month: int,
    origin: str,
    destination: str,
    db: FreightDatabase,
) -> tuple[str, list[str]]:
    """
    Generate shipment recommendation and data-driven reasons.
    
    Recommendations:
        RAIL_RECOMMENDED - Strong rail case
        RAIL_WITH_CONSOLIDATION - Rail with consolidation advised
        RAIL_FEASIBLE - Rail is an option but not clearly best
        MULTIMODAL_SUGGESTED - Consider road-rail combination
        INSUFFICIENT_DATA - Cannot make a reliable recommendation
    """
    reasons = []
    score = 0
    
    # Rail suitability contribution
    if rail_suitability >= 80:
        score += 30
        reasons.append(
            f"{commodity} has high rail suitability ({rail_suitability:.0f}/100) "
            f"based on historical freight patterns"
        )
    elif rail_suitability >= 60:
        score += 15
        reasons.append(
            f"{commodity} has moderate rail suitability ({rail_suitability:.0f}/100)"
        )
    else:
        score -= 10
        reasons.append(
            f"{commodity} has lower rail suitability ({rail_suitability:.0f}/100)"
        )
    
    # Weight contribution
    optimal = config.shipment.optimal_rail_weight_tonnes
    if weight_tonnes >= optimal:
        score += 25
        reasons.append(
            f"Shipment weight ({weight_tonnes}t) supports full trainload economics"
        )
    elif weight_tonnes >= config.shipment.min_rail_weight_tonnes:
        score += 10
        reasons.append(
            f"Shipment weight ({weight_tonnes}t) is viable for rail but "
            f"below optimal trainload ({optimal}t)"
        )
    else:
        score -= 15
        reasons.append(
            f"Shipment weight ({weight_tonnes}t) is below minimum efficient "
            f"rail threshold ({config.shipment.min_rail_weight_tonnes}t)"
        )
    
    # Consolidation factor
    if consolidation > 70:
        score += 10
        reasons.append(
            f"High consolidation potential ({consolidation:.0f}/100) - "
            f"combining with other shipments can improve economics"
        )
    
    # Network pressure factor
    if network_pressure > 70:
        score -= 10
        reasons.append(
            f"Network pressure is elevated ({network_pressure:.0f}/100), "
            f"which may impact transit times"
        )
    elif network_pressure < 40:
        score += 5
        reasons.append(
            f"Network pressure is low ({network_pressure:.0f}/100), "
            f"favorable conditions for rail freight"
        )
    
    # Demand outlook
    if demand_outlook in ("HIGH", "VERY_HIGH"):
        score += 5
        reasons.append(
            f"Demand outlook is {demand_outlook} for {commodity} "
            f"in month {month}, suggesting robust rail capacity allocation"
        )
    elif demand_outlook == "LOW":
        score += 5  # Low demand actually means less competition
        reasons.append(
            f"Demand outlook is {demand_outlook}, potentially better "
            f"availability and service levels"
        )
    
    # Generate recommendation
    if score >= 50:
        if consolidation > 70 and weight_tonnes < optimal:
            recommendation = "RAIL_WITH_CONSOLIDATION"
        else:
            recommendation = "RAIL_RECOMMENDED"
    elif score >= 25:
        recommendation = "RAIL_FEASIBLE"
    elif score >= 0:
        recommendation = "MULTIMODAL_SUGGESTED"
    else:
        recommendation = "MULTIMODAL_SUGGESTED"
    
    return recommendation, reasons
