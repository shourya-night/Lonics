import asyncio
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any

from schemas import BookingRequest, BookingResponse
from services import FreightEngine

app = FastAPI(
    title="Lonics Core Engine",
    description="Multi-agent logistics orchestration platform state machine backend.",
    version="1.0.0",
)

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

@app.post("/api/v1/freight/book", response_model=BookingResponse)
def book_freight(request: BookingRequest):
    """
    POST endpoint to request a freight booking.
    Calculates weights, pricing spread, and updates container co-loading capacity.
    """
    try:
        response = FreightEngine.process_booking(request, container_state)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Booking processing error: {str(e)}")

@app.post("/api/v1/freight/cancel/{booking_id}")
async def cancel_freight(booking_id: str, background_tasks: BackgroundTasks):
    """
    POST endpoint to cancel an active booking.
    Triggers asynchronous background task simulating Temporal Saga rollbacks.
    """
    background_tasks.add_task(rollback_saga_task, booking_id)
    return {
        "status": "rollback_initiated",
        "booking_id": booking_id,
        "detail": "Background rollback saga tasks queued for execution."
    }

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
            return {
                "window_id": container_row["window_id"],
                "current_cbm": round(float(container_row.get("cbm", 0.0)), 3),
                "current_kg": round(float(container_row.get("kg", 0.0)), 2),
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

@app.get("/health")
def health_check():
    """
    Health check endpoint.
    """
    return {"status": "healthy"}
