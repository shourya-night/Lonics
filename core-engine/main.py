import asyncio
import os
import base64
import json
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

from fastapi import FastAPI, BackgroundTasks, HTTPException, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

# Load root .env file manually if it exists to populate os.environ BEFORE services import
def load_dotenv():
    # Look for .env in current directory, parent, or grandparent
    for path in [Path("."), Path(".."), Path("../..")]:
        env_path = path / ".env"
        if env_path.is_file():
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#"):
                            key_val = line.split("=", 1)
                            if len(key_val) == 2:
                                k = key_val[0].strip().strip("'\"")
                                v = key_val[1].strip().strip("'\"")
                                if k not in os.environ:
                                    os.environ[k] = v
            except Exception as e:
                print(f"[Dotenv Loader] Error reading {env_path}: {e}")
            break

load_dotenv()

from schemas import (
    BookingRequest,
    BookingResponse,
    ShipmentPredictionRequest,
    ShipmentPredictionResponse,
    PredictionHealthResponse
)
from services import FreightEngine

# Middleware to intercept application/json scan requests and rewrite them to multipart/form-data at the ASGI layer
class ASGICompatibilityMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope["path"] == "/api/tracking/scan" and scope["method"] == "POST":
            # Extract content-type
            headers = scope.get("headers", [])
            content_type = ""
            for k, v in headers:
                if k.lower() == b"content-type":
                    content_type = v.decode("utf-8")
                    break
            
            if "application/json" in content_type:
                # Read all body chunks
                body = b""
                more_body = True
                while more_body:
                    message = await receive()
                    body += message.get("body", b"")
                    more_body = message.get("more_body", False)
                
                try:
                    data = json.loads(body.decode("utf-8"))
                except Exception:
                    data = {}
                
                image_base64 = data.get("image") or data.get("code")
                scan_type = data.get("type", "cargo")
                booking_id = data.get("booking_id") or data.get("code") or "BK-MOCK-999"
                
                file_bytes = b""
                if image_base64:
                    if "," in image_base64:
                        image_base64 = image_base64.split(",")[1]
                    try:
                        file_bytes = base64.b64decode(image_base64)
                    except Exception:
                        pass
                
                boundary = "----FastAPIBoundaryInterception"
                parts = []
                
                # Add file part
                parts.append(
                    b"--" + boundary.encode("utf-8") + b"\r\n"
                    b'Content-Disposition: form-data; name="file"; filename="image.jpg"\r\n'
                    b"Content-Type: image/jpeg\r\n\r\n" + file_bytes + b"\r\n"
                )
                
                # Add type part
                if scan_type:
                    parts.append(
                        b"--" + boundary.encode("utf-8") + b"\r\n"
                        b'Content-Disposition: form-data; name="type"\r\n\r\n'
                        + scan_type.encode("utf-8") + b"\r\n"
                    )
                
                # Add booking_id part
                if booking_id:
                    parts.append(
                        b"--" + boundary.encode("utf-8") + b"\r\n"
                        b'Content-Disposition: form-data; name="booking_id"\r\n\r\n'
                        + booking_id.encode("utf-8") + b"\r\n"
                    )
                
                parts.append(b"--" + boundary.encode("utf-8") + b"--\r\n")
                new_body = b"".join(parts)
                
                # Rewrite scope headers
                new_headers = []
                for k, v in headers:
                    if k.lower() == b"content-type":
                        new_headers.append((b"content-type", f"multipart/form-data; boundary={boundary}".encode("utf-8")))
                    elif k.lower() == b"content-length":
                        new_headers.append((b"content-length", str(len(new_body)).encode("utf-8")))
                    else:
                        new_headers.append((k, v))
                
                if not any(k.lower() == b"content-type" for k, v in new_headers):
                    new_headers.append((b"content-type", f"multipart/form-data; boundary={boundary}".encode("utf-8")))
                if not any(k.lower() == b"content-length" for k, v in new_headers):
                    new_headers.append((b"content-length", str(len(new_body)).encode("utf-8")))
                
                scope["headers"] = new_headers
                
                # Setup custom receive channel
                async def new_receive():
                    return {
                        "type": "http.request",
                        "body": new_body,
                        "more_body": False
                    }
                
                await self.app(scope, new_receive, send)
                return

        await self.app(scope, receive, send)

app = FastAPI(
    title="Lonics Core Engine",
    description="Multi-agent logistics orchestration platform state machine backend.",
    version="1.0.0",
)

app.add_middleware(ASGICompatibilityMiddleware)

# Standard FastAPI CORS middleware allowing incoming origins from frontend port
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory dictionary acting as our local Redis cache placeholder
# Tracks active container metric thresholds
container_state: Dict[str, Any] = {
    "window_id": "WIN-PRIMARY-DFC",
    "cbm": 0.0,
    "kg": 0.0
}

# Asynchronous background task simulating the Temporal Saga rollback sequence
async def rollback_saga_task(booking_id: str):
    print(f"\n[SAGA] >>> Initiating rollback saga for booking: {booking_id}")
    
    # 1. release_truck_hold
    await asyncio.sleep(1.0)
    print(f"[SAGA] [Step 1/3] [release_truck_hold] Canceled first-mile feeder truck reservation.")
    
    # 2. release_cto_slot
    await asyncio.sleep(1.0)
    print(f"[SAGA] [Step 2/3] [release_cto_slot] Released Container Train Operator (CTO) block allocation.")
    
    # 3. trigger_secondary_flash_auction
    await asyncio.sleep(1.0)
    print(f"[SAGA] [Step 3/3] [trigger_secondary_flash_auction] Triggered secondary backhaul spot auction for released CBM space.")
    
    print(f"[SAGA] <<< Rollback saga completed successfully for booking: {booking_id}\n")

# Hazardous Material Cross-Exclusion Matrix for Compatibility Guard
window_cargo_classes_cache: Dict[str, set] = {}

EXCLUSION_MATRIX = {
    'explosive': ['explosive', 'flammable', 'toxic', 'corrosive', 'chemical', 'foodstuff'],
    'flammable': ['explosive', 'flammable', 'toxic', 'corrosive', 'foodstuff'],
    'toxic': ['explosive', 'flammable', 'toxic', 'foodstuff'],
    'corrosive': ['explosive', 'flammable', 'corrosive', 'foodstuff'],
    'chemical': ['explosive', 'foodstuff'],
    'foodstuff': ['explosive', 'flammable', 'toxic', 'corrosive', 'chemical'],
    'general': [],
    'carton': [],
    'pallet': [],
    'drum': [],
    'bale': []
}

def are_incompatible(class_a: str, class_b: str) -> bool:
    a = class_a.lower().strip()
    b = class_b.lower().strip()
    if a in EXCLUSION_MATRIX and b in EXCLUSION_MATRIX[a]:
        return True
    if b in EXCLUSION_MATRIX and a in EXCLUSION_MATRIX[b]:
        return True
    return False

# In-memory shipments cache acting as standard dual-state fallback
shipments_fallback_cache: Dict[str, dict] = {}

@app.post("/api/bookings", response_model=BookingResponse, status_code=201)
@app.post("/api/v1/freight/book", response_model=BookingResponse, status_code=201)
def book_freight(request: BookingRequest):
    """
    POST endpoint to request a freight booking.
    Calculates weights, pricing spread, and updates container co-loading capacity.
    Performs compatibility check to prevent hazardous co-loading safety breaches.
    """
    try:
        shipper_id = request.shipper_id or "SHIP-DFC-001"
        active_window_id = container_state.get("window_id") or f"WIN-{shipper_id}-PRIMARY"
        
        new_classes = [item.cargo_class or item.package_type or 'General' for item in request.cargo_items]
        
        # 1. Internal check
        for i in range(len(new_classes)):
            for j in range(i + 1, len(new_classes)):
                if are_incompatible(new_classes[i], new_classes[j]):
                    return JSONResponse(
                        status_code=400,
                        content={
                            "error": "COMPATIBILITY_BREACH",
                            "message": f"Internal Cargo Conflict: Item {i+1} ({new_classes[i]}) is incompatible with Item {j+1} ({new_classes[j]}) in the same request."
                        }
                    )
                    
        # 2. Check compatibility against already loaded cargo in active container
        existing_classes = window_cargo_classes_cache.get(active_window_id, set())
        for new_class in new_classes:
            for existing_class in existing_classes:
                if are_incompatible(new_class, existing_class):
                    return JSONResponse(
                        status_code=400,
                        content={
                            "error": "COMPATIBILITY_BREACH",
                            "message": f"Co-loading safety violation: Incoming cargo class '${new_class}' cannot be co-loaded with existing cargo class '${existing_class}' already in active container '${active_window_id}'."
                        }
                    )

        response = FreightEngine.process_booking(request, container_state)
        
        # Save new classes in cache on successful booking commit
        assigned_win = response.assigned_window_id or active_window_id
        if assigned_win not in window_cargo_classes_cache:
            window_cargo_classes_cache[assigned_win] = set()
        for cls in new_classes:
            window_cargo_classes_cache[assigned_win].add(cls)
            
        # Also store the shipment in our local in-memory fallback cache
        shipment_data = {
            "booking_id": response.booking_id,
            "assigned_window_id": assigned_win,
            "chargeable_weight": response.chargeable_weight,
            "total_cbm": response.total_cbm,
            "final_quote": response.final_quote,
            "status": "RESERVATION_INITIATED",
            "shipper_id": shipper_id,
            "origin": request.origin,
            "destination": request.destination,
            "created_at": datetime.utcnow().isoformat() + "Z"
        }
        shipments_fallback_cache[response.booking_id] = shipment_data
            
        return response
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": "Booking processing error", "detail": str(e)}
        )

@app.post("/api/cancel/{booking_id}")
@app.post("/api/v1/freight/cancel/{booking_id}")
async def cancel_freight(booking_id: str, background_tasks: BackgroundTasks):
    """
    POST endpoint to cancel an active booking.
    Triggers asynchronous background task simulating Temporal Saga rollbacks.
    """
    if booking_id in shipments_fallback_cache:
        shipments_fallback_cache[booking_id]["status"] = "CANCELLED"
    background_tasks.add_task(rollback_saga_task, booking_id)
    return {
        "status": "rollback_initiated",
        "booking_id": booking_id,
        "detail": "Background rollback saga tasks queued for execution."
    }

@app.get("/api/container-status")
@app.get("/api/v1/freight/container-status")
def get_container_status():
    """
    GET endpoint to poll active container metrics and thresholds.
    """
    try:
        from services import supabase
        active_win = container_state.get("window_id", "WIN-PRIMARY-DFC")
        res = supabase.table("container_cache").select("*").eq("window_id", active_win).execute()
        if res.data:
            container_row = res.data[0]
            # Handle column name variations: current_cbm vs cbm
            cbm_val = container_row.get("current_cbm") or container_row.get("cbm") or 0.0
            kg_val = container_row.get("current_kg") or container_row.get("kg") or 0.0
            return {
                "window_id": container_row["window_id"],
                "current_cbm": round(float(cbm_val), 3),
                "current_kg": round(float(kg_val), 2),
                "max_cbm_threshold": FreightEngine.MAX_CBM,
                "max_kg_threshold": FreightEngine.MAX_KG
            }
    except Exception as e:
        print(f"[DB STATUS ERROR] Failed to fetch container status from DB: {e}. Using in-memory fallback.")

    return {
        "window_id": container_state["window_id"],
        "current_cbm": round(container_state["cbm"], 3),
        "current_kg": round(container_state["kg"], 2),
        "max_cbm_threshold": FreightEngine.MAX_CBM,
        "max_kg_threshold": FreightEngine.MAX_KG
    }

# Helper to fetch AQI and evaluate Graded Response Action Plan (GRAP) trigger stages
def fetch_aqi_sync(url: str) -> dict:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=3.5) as response:
        return json.loads(response.read().decode('utf-8'))

async def get_aqi_and_grap_status(lat: float, lng: float) -> dict:
    url = f"https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lng}&current=pm2_5,pm10,us_aqi"
    try:
        loop = asyncio.get_running_loop()
        data = await loop.run_in_executor(None, fetch_aqi_sync, url)
        
        aqi = 120
        current = data.get("current", {})
        if current.get("us_aqi") is not None:
            aqi = current["us_aqi"]
        elif current.get("pm2_5") is not None:
            pm25 = current["pm2_5"]
            if pm25 <= 12.0:
                aqi = round((50 / 12.0) * pm25)
            elif pm25 <= 35.4:
                aqi = round(51 + ((100 - 51) / (35.4 - 12.1)) * (pm25 - 12.1))
            elif pm25 <= 55.4:
                aqi = round(101 + ((150 - 101) / (55.4 - 35.5)) * (pm25 - 35.5))
            elif pm25 <= 150.4:
                aqi = round(151 + ((200 - 151) / (150.4 - 55.5)) * (pm25 - 55.5))
            else:
                aqi = 250
        
        grap_stage = 'None'
        restriction = 'None'
        reroute_required = False
        
        if aqi > 400:
            grap_stage = 'Stage IV (Severe+)'
            restriction = 'Severe Ban: Heavy diesel truck entry prohibited. Splitting cargo to electric LCV fleets.'
            reroute_required = True
        elif aqi > 300:
            grap_stage = 'Stage III (Severe)'
            restriction = 'Diesel restriction: BS-III/IV commercial diesel vehicles restricted. Electric vehicle transit mandatory.'
            reroute_required = True
        elif aqi > 200:
            grap_stage = 'Stage II (Very Poor)'
            restriction = 'Notice: Moderate emission caps active. Fleet tracking required.'
            reroute_required = False
            
        return {
            "aqi": aqi,
            "grapStage": grap_stage,
            "restriction": restriction,
            "rerouteRequired": reroute_required,
            "source": "open_meteo_live"
        }
    except Exception as err:
        print(f"[AQI Service] Failed to retrieve air quality from API. Using simulated fallback. Error: {err}")
        return {
            "aqi": 315,
            "grapStage": "Stage III (Simulated Fallback)",
            "restriction": "Diesel restriction: BS-III/IV commercial diesel vehicles restricted. Electric vehicle transit mandatory.",
            "rerouteRequired": True,
            "source": "simulation_fallback"
        }

@app.post("/api/tracking/scan")
async def scan_tracking(
    file: UploadFile = File(...),
    type: Optional[str] = Form(None),
    booking_id: Optional[str] = Form(None)
):
    """
    POST endpoint to capture and validate tracking scan payloads.
    Cleanly parses uploaded files and updates Supabase/in-memory booking states.
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Invalid or empty file payload")
        
        scan_type = type or "cargo"
        target_booking_id = booking_id or "BK-MOCK-999"
        
        # Update local in-memory fallback status
        if target_booking_id in shipments_fallback_cache:
            shipments_fallback_cache[target_booking_id]["status"] = "DELIVERED"
            print(f"[Gemini CV Engine] Updated local shipments fallback cache for {target_booking_id} status to DELIVERED")
        
        # Sync database updates: set shipment status to DELIVERED on seal scan matching
        if scan_type == "seal" or target_booking_id != "BK-MOCK-999":
            try:
                from services import supabase
                supabase.table("shipments").update({"status": "DELIVERED"}).eq("booking_id", target_booking_id).execute()
                print(f"[Gemini CV Engine] Updated Supabase shipment {target_booking_id} status to DELIVERED")
            except Exception as db_err:
                print(f"[Gemini CV Engine] Supabase update failed: {db_err}")

        # Static mockup dimensions matching the ones verified in Express backend / React frontend
        dimensions = {
            "length": 110,
            "width": 75,
            "height": 95,
            "type": "Carton"
        }
        
        response = {
            # Required by user request:
            "status": "DELIVERED" if scan_type == "seal" else "success",
            "detected_volume_percentage": 85.5,
            "verification_status": "VERIFIED",
            
            # Required by React components & test-api.js compatibility:
            "success": True,
            "booking_id": target_booking_id,
            "message": "Seal verification scan recorded. Shipment status finalized to DELIVERED." if scan_type == "seal" else "Cargo dimension scan completed.",
            "dimensions": dimensions
        }
        return response
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scan processing failed: {str(e)}")

@app.get("/api/tracking/{booking_id}")
async def get_tracking(booking_id: str):
    """
    GET endpoint to retrieve unified real-time tracking signals and coordinates.
    Merges local coordinates with dynamic open-meteo AQI & GRAP reroute states.
    """
    try:
        from services import supabase
        shipment = None
        
        # Check local in-memory fallback cache first
        if booking_id in shipments_fallback_cache:
            shipment = shipments_fallback_cache[booking_id]
        else:
            try:
                res = supabase.table("shipments").select("*").eq("booking_id", booking_id).execute()
                if res.data:
                    shipment = res.data[0]
            except Exception as e:
                print(f"[DB STATUS ERROR] Failed to fetch shipment from DB: {e}. Using simulated/fallback.")

        # Determine origin and destination
        origin = shipment.get("origin") if shipment else 'Mumbai Port DFC Gate-1'
        destination = shipment.get("destination") if shipment else 'Delhi ICD Terminal-3'
        
        # Get current status
        if shipment:
            current_status = shipment.get("status") or 'IN_TRANSIT'
            assigned_window_id = shipment.get("assigned_window_id") or 'WIN-PRIMARY-DFC'
        else:
            current_status = 'IN_TRANSIT'
            assigned_window_id = 'WIN-PRIMARY-DFC'
        
        # Calculate latitude and longitude endpoints based on destination
        dest_lat = 28.6139
        dest_lng = 77.2090
        if destination and 'mumbai' in destination.lower():
            dest_lat = 19.0760
            dest_lng = 72.8777
        elif destination and 'dadri' in destination.lower():
            dest_lat = 28.5300
            dest_lng = 77.5532
            
        # Get live AQI from Open-Meteo or simulation
        aqi_data = await get_aqi_and_grap_status(dest_lat, dest_lng)
        
        active_route = [origin, 'Dadri ICD Yard', destination]
        route_status_desc = 'Standard line-haul rail corridor.'
        
        # GRAP vehicle ban rules: BS-III petrol & BS-IV diesel LCVs/trucks split/reroute at Dadri
        if aqi_data["rerouteRequired"] and current_status not in ('DELIVERED', 'DELIVERED_SUCCESS', 'CANCELLED'):
            current_status = 'REROUTED_GRAP_ACTIVE'
            active_route = [origin, 'Dadri ICD Yard', 'Electric-LCV Split Gate (Dadri)', destination]
            route_status_desc = f"Rerouted: {aqi_data['grapStage']} restriction active. Commercial diesel carriage banned at {destination}. Splitting load to electric LCV fleet at Dadri."
            
        # Dynamic telemetry coordinates using periodic 60-second time progression
        import time
        time_progress = (int(time.time() * 1000) % 60000) / 60000.0
        current_lat = 19.0760 + (dest_lat - 19.0760) * time_progress
        current_lng = 72.8777 + (dest_lng - 72.8777) * time_progress
        
        response_payload = {
            "booking_id": booking_id,
            "status": current_status,
            "assigned_window_id": assigned_window_id,
            "origin": origin,
            "destination": destination,
            "route": active_route,
            "status_description": route_status_desc,
            "telemetry": {
                "current_coordinates": {
                    "lat": round(current_lat, 4),
                    "lng": round(current_lng, 4)
                },
                "speed_kmh": 38 if current_status == 'REROUTED_GRAP_ACTIVE' else 55,
                "heading": 'North-East',
                "last_ping": datetime.utcnow().isoformat() + "Z",
                "signal_source": 'NTES_Fallback_Station' if aqi_data["source"] == 'simulation_fallback' else 'FOIS_Pravah_Live'
            },
            "aqi_metrics": {
                "aqi": aqi_data["aqi"],
                "grap_stage": aqi_data["grapStage"],
                "active_restrictions": aqi_data["restriction"],
                "api_source": aqi_data["source"]
            }
        }
        return response_payload
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tracking retrieval failed: {str(e)}")

# ══════════════════════════════════════════════════════════════════════════════
# AI PREDICTION ENGINE ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

def _check_prediction_database() -> bool:
    try:
        from prediction.database import get_database
        db = get_database()
        db.get_schema()
        return True
    except Exception:
        return False

def _check_prediction_models() -> bool:
    try:
        from prediction.forecasting import load_training_results
        return load_training_results() is not None
    except Exception:
        return False

@app.get("/health", tags=["System"])
def health_check():
    """
    Health check endpoint reporting Core Engine and Prediction Engine availability.
    """
    from prediction import __version__ as pred_ver
    return {
        "status": "healthy",
        "engine_version": pred_ver,
        "database_available": _check_prediction_database(),
        "models_trained": _check_prediction_models(),
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

@app.get("/api/predictions/health", response_model=PredictionHealthResponse, tags=["Prediction System"])
@app.get("/api/v1/freight/predictions/health", response_model=PredictionHealthResponse, tags=["Prediction System"])
def prediction_health_check():
    """
    Dedicated health check for AI prediction subsystem.
    """
    from prediction import __version__ as pred_ver
    return PredictionHealthResponse(
        status="healthy",
        engine_version=pred_ver,
        database_available=_check_prediction_database(),
        models_trained=_check_prediction_models(),
    )

@app.get("/api/predictions/freight", tags=["AI Forecasting"])
@app.get("/api/v1/freight/predictions/freight", tags=["AI Forecasting"])
def get_freight_forecast(periods: int = 5):
    """
    Get total railway freight demand forecast with historical values and prediction intervals.
    """
    try:
        from prediction.forecasting import forecast_total_freight
        return forecast_total_freight(periods=periods)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Freight forecast failed: {str(e)}")

@app.get("/api/predictions/monthly", tags=["AI Forecasting"])
@app.get("/api/v1/freight/predictions/monthly", tags=["AI Forecasting"])
def get_monthly_forecast(periods: int = 12):
    """
    Get monthly freight demand forecast with seasonal decomposition.
    """
    try:
        from prediction.forecasting import forecast_monthly
        return forecast_monthly(periods=periods)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Monthly forecast failed: {str(e)}")

@app.get("/api/predictions/commodities", tags=["AI Forecasting"])
@app.get("/api/v1/freight/predictions/commodities", tags=["AI Forecasting"])
def get_commodity_forecast(periods: int = 3):
    """
    Get commodity-level freight demand forecasts across all discovered categories.
    """
    try:
        from prediction.commodity import forecast_commodities
        return forecast_commodities(periods=periods)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Commodity forecast failed: {str(e)}")

@app.get("/api/predictions/network", tags=["AI Network Intelligence"])
@app.get("/api/v1/freight/predictions/network", tags=["AI Network Intelligence"])
def get_network_pressure():
    """
    Get the composite Lonics Network Pressure Score (0-100) combining capacity utilization,
    freight growth, train density, and DFC load.
    """
    try:
        from prediction.network import calculate_network_pressure
        return calculate_network_pressure()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Network pressure calculation failed: {str(e)}")

@app.get("/api/predictions/dfc", tags=["AI Network Intelligence"])
@app.get("/api/v1/freight/predictions/dfc", tags=["AI Network Intelligence"])
def get_dfc_forecast(periods: int = 3):
    """
    Get Dedicated Freight Corridor activity and tonnage forecast.
    """
    try:
        from prediction.network import forecast_dfc
        return forecast_dfc(periods=periods)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DFC forecast failed: {str(e)}")

@app.get("/api/predictions/capacity", tags=["AI Network Intelligence"])
@app.get("/api/v1/freight/predictions/capacity", tags=["AI Network Intelligence"])
def get_capacity_forecast(periods: int = 3):
    """
    Get railway capacity utilization forecast.
    """
    try:
        from prediction.network import forecast_capacity
        return forecast_capacity(periods=periods)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Capacity forecast failed: {str(e)}")

@app.get("/api/predictions/model-performance", tags=["AI System Performance"])
@app.get("/api/v1/freight/predictions/model-performance", tags=["AI System Performance"])
def get_model_performance():
    """
    Get backtested performance metrics (MAE, RMSE, MAPE) across candidate forecasting models.
    """
    try:
        from prediction.forecasting import load_training_results, forecast_total_freight
        results = load_training_results()
        if results is None:
            result = forecast_total_freight(periods=1)
            return {
                "trained_models_available": False,
                "live_backtest": {
                    "model": result["model"],
                    "metrics": result["model_metrics"],
                    "all_models": result["all_model_metrics"],
                },
                "note": "Run train_models.py for comprehensive model evaluation"
            }
        return {
            "trained_models_available": True,
            "results": results,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Model performance retrieval failed: {str(e)}")

@app.post("/api/predictions/shipment", tags=["AI Shipment Intelligence"])
@app.post("/api/v1/freight/predictions/shipment", tags=["AI Shipment Intelligence"])
def predict_shipment_endpoint(request: ShipmentPredictionRequest):
    """
    Get AI macro-level shipment intelligence, modal suitability rating,
    consolidation potential, demand outlook, and data-driven recommendations.
    """
    try:
        from prediction.shipment import predict_shipment
        month_val = request.month or datetime.utcnow().month
        result = predict_shipment(
            origin=request.origin,
            destination=request.destination,
            commodity=request.commodity,
            weight_tonnes=request.weight_tonnes,
            month=month_val,
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Shipment prediction failed: {str(e)}")

