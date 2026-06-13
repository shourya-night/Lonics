import os
import uuid
import time
from typing import Dict, Tuple
from schemas import BookingRequest, BookingResponse, ShipmentStatus
from supabase import create_client, Client

# Initialize Supabase Client with standard fallback values
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://onqtnrkginxohmdjawca.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "sb_publishable__NYEjekH8Q8Ek6XEwGpAsA_dDbCTdwQ")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class FreightEngine:
    # Constants
    VWF = 5000.0       # Volumetric Weight Factor (cm3/kg)
    MAX_CBM = 28.0     # Maximum Volume Capacity of co-loaded container (CBM)
    MAX_KG = 18000.0   # Maximum Weight Capacity of co-loaded container (KG)

    @classmethod
    def calculate_metrics(cls, request: BookingRequest) -> Tuple[float, float, float]:
        """
        Calculates cargo metrics: (chargeable_weight, total_cbm, total_actual_weight)
        """
        total_actual_weight = 0.0
        total_volumetric_weight = 0.0
        total_cbm = 0.0

        for item in request.cargo_items:
            # Volume in cubic centimeters
            volume_cm3 = item.length * item.width * item.height * item.quantity
            
            # CBM: 1 CBM = 1,000,000 cm³
            cbm = volume_cm3 / 1000000.0
            total_cbm += cbm

            # Volumetric weight
            vol_wt = volume_cm3 / cls.VWF
            total_volumetric_weight += vol_wt

            # Actual weight
            total_actual_weight += item.weight_kg * item.quantity

        chargeable_weight = max(total_actual_weight, total_volumetric_weight)
        return chargeable_weight, total_cbm, total_actual_weight

    @classmethod
    def process_booking(cls, request: BookingRequest, container_state: dict) -> BookingResponse:
        """
        Processes a cargo booking: computes rates, checks capacity breaches,
        and transitions the container window state if threshold is violated.
        Integrates Supabase PostgreSQL persistence with local state fallbacks.
        """
        chargeable_weight, cargo_cbm, cargo_kg = cls.calculate_metrics(request)

        # Dual-Brain Price Spread: Rail vs Road Shadow Price
        # Using requested multipliers: Rail Base = weight * 9.0; Road shadow = weight * 14.5
        rail_base_price = chargeable_weight * 9.0
        road_shadow_price = chargeable_weight * 14.5
        
        # We use Rail Base as our standard billing price for this LCL platform
        base_price = rail_base_price

        # Fetch container state from Supabase
        db_active = False
        current_cbm = 0.0
        current_kg = 0.0
        current_window_id = "WIN-PRIMARY-DFC"

        try:
            # Try querying the active window state
            active_win = container_state.get("window_id", "WIN-PRIMARY-DFC")
            res = supabase.table("container_cache").select("*").eq("window_id", active_win).execute()
            if not res.data:
                # Initialize active window if not present
                insert_res = supabase.table("container_cache").insert({
                    "window_id": active_win,
                    "cbm": container_state.get("cbm", 0.0),
                    "kg": container_state.get("kg", 0.0)
                }).execute()
                container_row = insert_res.data[0]
            else:
                container_row = res.data[0]

            current_cbm = float(container_row.get("cbm", 0.0))
            current_kg = float(container_row.get("kg", 0.0))
            current_window_id = container_row.get("window_id", "WIN-PRIMARY-DFC")
            db_active = True
        except Exception as e:
            print(f"[DB EXCEPTION] container_cache lookup failed: {e}. Falling back to in-memory state.")
            current_cbm = container_state.get("cbm", 0.0)
            current_kg = container_state.get("kg", 0.0)
            current_window_id = container_state.get("window_id", "WIN-PRIMARY-DFC")

        # Dynamic contingency buffer based on current capacity occupancy (before adding new cargo)
        capacity_utilization = current_cbm / cls.MAX_CBM
        contingency_buffer = base_price * capacity_utilization * 0.15

        # Base price + buffer
        total_price = base_price + contingency_buffer

        # Apply flat 12% margin lock upgrade if rail_lock_upgrade is enabled
        if request.rail_lock_upgrade:
            total_price = total_price * 1.12

        new_cbm = current_cbm + cargo_cbm
        new_kg = current_kg + cargo_kg
        assigned_window_id = current_window_id

        # Evaluate threshold violations
        is_breached = (new_cbm > cls.MAX_CBM or new_kg > cls.MAX_KG)

        if is_breached:
            # Generate new window identifier
            unique_suffix = str(uuid.uuid4())[:8].upper()
            assigned_window_id = f"WIN-DFC-{unique_suffix}-NEW"
            new_cbm = cargo_cbm
            new_kg = cargo_kg

        # Perform atomic database writes & update operations
        if db_active:
            try:
                if is_breached:
                    supabase.table("container_cache").insert({
                        "window_id": assigned_window_id,
                        "cbm": new_cbm,
                        "kg": new_kg
                    }).execute()
                else:
                    supabase.table("container_cache").update({
                        "cbm": new_cbm,
                        "kg": new_kg
                    }).eq("window_id", assigned_window_id).execute()
            except Exception as e:
                print(f"[DB EXCEPTION] container_cache mutation failed: {e}")

        # Update local fallback container_state
        if is_breached:
            container_state["window_id"] = assigned_window_id
            container_state["cbm"] = cargo_cbm
            container_state["kg"] = cargo_kg
        else:
            container_state["window_id"] = assigned_window_id
            container_state["cbm"] = new_cbm
            container_state["kg"] = new_kg

        booking_id = f"BK-{str(uuid.uuid4())[:8].upper()}"

        # Write shipment record to database
        if db_active:
            try:
                supabase.table("shipments").insert({
                    "booking_id": booking_id,
                    "assigned_window_id": assigned_window_id,
                    "chargeable_weight": round(chargeable_weight, 2),
                    "total_cbm": round(cargo_cbm, 3),
                    "base_price": round(base_price, 2),
                    "contingency_buffer": round(contingency_buffer, 2),
                    "final_quote": round(total_price, 2),
                    "status": ShipmentStatus.RESERVATION_INITIATED.value
                }).execute()
            except Exception as e:
                print(f"[DB EXCEPTION] shipments insertion failed: {e}")

        return BookingResponse(
            booking_id=booking_id,
            chargeable_weight=round(chargeable_weight, 2),
            total_cbm=round(cargo_cbm, 3),
            base_price=round(base_price, 2),
            contingency_buffer=round(contingency_buffer, 2),
            final_quote=round(total_price, 2),
            status=ShipmentStatus.RESERVATION_INITIATED,
            assigned_window_id=assigned_window_id
        )
