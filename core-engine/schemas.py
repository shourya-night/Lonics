from enum import Enum
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class ShipmentStatus(str, Enum):
    QUOTE_PENDING = 'QUOTE_PENDING'
    RESERVATION_INITIATED = 'RESERVATION_INITIATED'
    FIRST_MILE_PICKUP = 'FIRST_MILE_PICKUP'
    CONSOLIDATION_HUB_GATE_IN = 'CONSOLIDATION_HUB_GATE_IN'
    LINE_HAUL_RAIL_TRANSIT = 'LINE_HAUL_RAIL_TRANSIT'
    DESTINATION_DE_STUFFING = 'DESTINATION_DE_STUFFING'
    LAST_MILE_URBAN_ROUTING = 'LAST_MILE_URBAN_ROUTING'
    DELIVERED_SUCCESS = 'DELIVERED_SUCCESS'
    EXCEPTION_ISOLATED = 'EXCEPTION_ISOLATED'

class CargoItem(BaseModel):
    package_type: str = Field(..., description="Package type: Carton, Pallet, Drum, Bale")
    cargo_class: Optional[str] = Field("General", description="Cargo class: General, Toxic, Foodstuff, etc.")
    length: float = Field(..., description="Length in cm")
    width: float = Field(..., description="Width in cm")
    height: float = Field(..., description="Height in cm")
    quantity: int = Field(..., description="Quantity of packages")
    weight_kg: float = Field(..., description="Gross weight in KG per package")

class BookingRequest(BaseModel):
    shipper_id: str
    origin: str
    destination: str
    cargo_items: List[CargoItem]
    commodity: Optional[str] = Field(None, description="Optional commodity category (Containers, Coal, Cement, etc.)")
    rail_lock_upgrade: Optional[bool] = False

class BookingResponse(BaseModel):
    booking_id: str
    chargeable_weight: float
    total_cbm: float
    base_price: float
    contingency_buffer: float
    final_quote: float
    status: ShipmentStatus
    assigned_window_id: Optional[str] = None
    prediction_insights: Optional[Dict[str, Any]] = None

class ShipmentPredictionRequest(BaseModel):
    origin: str = Field(..., description="Origin city or terminal", examples=["Ludhiana"])
    destination: str = Field(..., description="Destination city or terminal", examples=["Mumbai"])
    commodity: str = Field("Containers", description="Commodity type: Containers, Coal, Cement, Iron Ore, Foodgrains, Others", examples=["Containers"])
    weight_tonnes: float = Field(..., gt=0, description="Shipment weight in metric tonnes", examples=[18.0])
    month: Optional[int] = Field(None, ge=1, le=12, description="Calendar month (1-12, defaults to current month)")

class ShipmentPredictionResponse(BaseModel):
    origin: str
    destination: str
    commodity: str
    weight_tonnes: float
    month: int
    rail_suitability: float
    consolidation_potential: float
    network_pressure: float
    demand_outlook: str
    recommendation: str
    reasons: List[str]
    data_limitations: List[str]

class PredictionHealthResponse(BaseModel):
    status: str
    engine_version: str
    database_available: bool
    models_trained: bool

