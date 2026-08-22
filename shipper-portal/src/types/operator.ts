/**
 * Canonical type definitions for the Lonics Operator Operations layer.
 *
 * These types are consumed by all operator surfaces:
 * - DriverDashboard (transport, GPS, pickup/drop)
 * - GroundOpsDashboard (seal scanning, receipt confirmation)
 * - ReturnExchangeAgent (rejected cargo, backhaul)
 *
 * Mission Control reads from the shared services that use these types — it does NOT own this state.
 */

// ──────────────────────────────────────────────────────────
// Core Role & Identity
// ──────────────────────────────────────────────────────────

export type OperatorRole = 'DRIVER' | 'GROUND_OPERATOR';

export interface OperatorProfile {
  operatorId: string;
  name: string;
  role: OperatorRole;
  /** Drivers only: vehicle registration e.g. 'LN-TRK-042' */
  vehicleId?: string;
  /** Ground operators only: terminal name e.g. 'Delhi ICD' */
  terminalId?: string;
  /** Shipment currently assigned to this operator */
  assignedShipmentId?: string;
}

// ──────────────────────────────────────────────────────────
// Shipment Lifecycle
// ──────────────────────────────────────────────────────────

/**
 * Ordered lifecycle states for a physical shipment movement.
 * Only forward transitions are valid — see operatorLogic.ts for state machine.
 */
export type ShipmentLifecycleStatus =
  | 'PENDING_PICKUP'
  | 'ARRIVED_AT_PICKUP'
  | 'PICKUP_CONFIRMED'
  | 'IN_TRANSIT'
  | 'ARRIVED_AT_DROP'
  | 'DELIVERY_CONFIRMED';

export interface ShipmentOrigin {
  name: string;
  address?: string;
  scheduledTime: string;       // e.g. '14:30'
  window: [string, string];   // e.g. ['14:00', '15:00']
}

export interface ShipmentDestination {
  name: string;
  address?: string;
  scheduledTime: string;
}

export interface AssignedShipment {
  shipmentId: string;
  cargo: {
    description: string;
    pallets: number;
    weightTonnes: number;
    containerType: string;    // e.g. "40' FEU"
    commodity?: string;
  };
  origin: ShipmentOrigin;
  destination: ShipmentDestination;
  seal: {
    id: string;
    verified: boolean;
    verifiedAt?: string;
    verifiedBy?: string;
  };
  status: ShipmentLifecycleStatus;
  truckId: string;
  driverName: string;
  /** Consolidated leg IDs if this is part of a multi-shipper container */
  consolidationLegs?: string[];
}

// ──────────────────────────────────────────────────────────
// Operational Events
// ──────────────────────────────────────────────────────────

export type OperationalEventType =
  // Driver events
  | 'ARRIVED_AT_PICKUP'
  | 'PICKUP_CONFIRMED'
  | 'IN_TRANSIT'
  | 'ARRIVED_AT_DROP'
  | 'DELIVERY_CONFIRMED'
  // Ground operator events
  | 'CARGO_RECEIVED'
  | 'SEAL_MISMATCH'
  | 'CARGO_REJECTED'
  // Return Exchange Agent events
  | 'RETURN_INITIATED'
  | 'BACKHAUL_OFFERED'
  | 'BACKHAUL_ACCEPTED'
  | 'BACKHAUL_DECLINED';

export interface OperationalEvent {
  eventType: OperationalEventType;
  shipmentId: string;
  sealId?: string;
  operatorId: string;
  /** Human-readable location string e.g. 'Delhi ICD Terminal-3' */
  location: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  metadata?: Record<string, any>;
}

// ──────────────────────────────────────────────────────────
// GPS & Realtime Location
// ──────────────────────────────────────────────────────────

export interface GPSUpdate {
  driverId: string;
  shipmentId: string;
  latitude: number;
  longitude: number;
  /** Accuracy in metres */
  accuracy: number;
  /** Speed in km/h, if available */
  speed?: number;
  /** Compass heading in degrees 0-360, if available */
  heading?: number;
  /** ISO 8601 timestamp from the GPS fix */
  timestamp: string;
  /**
   * Computed flag: true if timestamp is older than GPS_STALE_THRESHOLD_SECONDS (60s).
   * Set by isGPSStale() — not set by the driver device.
   */
  isStale?: boolean;
}

// ──────────────────────────────────────────────────────────
// Return Exchange Agent
// ──────────────────────────────────────────────────────────

export interface BackhaulOffer {
  offerId: string;
  currentRoute: { from: string; to: string };
  backhaulRoute: { from: string; to: string };
  cargoWeightTonnes: number;
  originalPrice: number;
  /** Fractional discount e.g. 0.40 = 40% off */
  discountRate: number;
  /** Computed: originalPrice × (1 - discountRate) */
  discountedPrice: number;
  compatibilityReasons: string[];
  /** ISO 8601 expiry — typically 2h from offer creation */
  expiresAt: string;
}

export interface ReturnDocumentationStatus {
  returnInitiated: boolean;
  documentsPrepared: boolean;
  /** E-Way Bill Part B update pending */
  ewayBillPending: boolean;
  movementAssigned: boolean;
}

export interface ReturnAction {
  shipmentId: string;
  /** Specific consolidated leg being returned e.g. 'LC-2847-B' */
  consolidationLeg: string;
  issueType: 'REJECTED' | 'DAMAGED' | 'REFUSED';
  affectedPallets: number;
  returnDestination: string;
  /** Ordered list of operator instructions */
  instructions: string[];
  /**
   * Other legs in the same container that are NOT affected and should continue.
   * e.g. ['LC-2847-A', 'LC-2847-C']
   */
  unaffectedLegs: string[];
  documentationStatus: ReturnDocumentationStatus;
}
