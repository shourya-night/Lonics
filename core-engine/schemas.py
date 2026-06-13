from enum import Enum
from pydantic import BaseModel, Field
from typing import List, Optional

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
