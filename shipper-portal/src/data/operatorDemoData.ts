/**
 * Canonical demo/seed data for the Lonics Operator Operations layer.
 *
 * This is the SINGLE SOURCE OF TRUTH for all demo operator data.
 * Components and pages import from here — they do NOT hardcode values in JSX.
 *
 * To change the backhaul discount, update BACKHAUL_DISCOUNT_RATE only.
 */

import type {
  OperatorProfile,
  AssignedShipment,
  BackhaulOffer,
  ReturnAction,
} from '../types/operator';

// ──────────────────────────────────────────────────────────
// Configurable Constants
// ──────────────────────────────────────────────────────────

/** Fractional backhaul discount offered to drivers with empty return capacity. Default: 40% off. */
export const BACKHAUL_DISCOUNT_RATE = 0.40;

/** GPS staleness threshold in seconds. Updates older than this are marked stale. */
export const GPS_STALE_THRESHOLD_SECONDS = 60;

// ──────────────────────────────────────────────────────────
// Demo Operator Profiles
// ──────────────────────────────────────────────────────────

export const DEMO_DRIVER: OperatorProfile = {
  operatorId: 'DRV-0042',
  name: 'Rajesh Kumar',
  role: 'DRIVER',
  vehicleId: 'LN-TRK-042',
  assignedShipmentId: 'LC-2847',
};

export const DEMO_GROUND_OP: OperatorProfile = {
  operatorId: 'GOP-0017',
  name: 'Priya Nair',
  role: 'GROUND_OPERATOR',
  terminalId: 'Delhi ICD',
  assignedShipmentId: 'LC-2847',
};

// ──────────────────────────────────────────────────────────
// Demo Shipment
// ──────────────────────────────────────────────────────────

export const DEMO_SHIPMENT: AssignedShipment = {
  shipmentId: 'LC-2847',
  cargo: {
    description: '6 pallets — Precision Engineering Components',
    pallets: 6,
    weightTonnes: 8.4,
    containerType: "40' FEU",
    commodity: 'Engineering & Automotive',
  },
  origin: {
    name: 'Delhi ICD Terminal-3',
    address: 'Tughlakabad ICD, New Delhi — 110020',
    scheduledTime: '14:30',
    window: ['14:00', '15:00'],
  },
  destination: {
    name: 'Mumbai JNPT Gate-2',
    address: 'JNPT, Nhava Sheva, Navi Mumbai — 400707',
    scheduledTime: '08:40',
  },
  seal: {
    id: 'SEAL-839201',
    verified: true,
    verifiedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    verifiedBy: 'GOP-0017',
  },
  status: 'IN_TRANSIT',
  truckId: 'LN-TRK-042',
  driverName: 'Rajesh Kumar',
  consolidationLegs: ['LC-2847-A', 'LC-2847-B', 'LC-2847-C'],
};

// ──────────────────────────────────────────────────────────
// Demo Consolidated Shipment Legs (for Return Exchange demo)
// ──────────────────────────────────────────────────────────

/** All leg IDs in this container — used for isolation logic demo */
export const DEMO_CONSOLIDATED_LEGS = ['LC-2847-A', 'LC-2847-B', 'LC-2847-C'];

/** The rejected leg in the Return Exchange demo */
export const DEMO_REJECTED_LEG = 'LC-2847-B';

// ──────────────────────────────────────────────────────────
// Demo Return Action
// ──────────────────────────────────────────────────────────

export const DEMO_RETURN_ACTION: ReturnAction = {
  shipmentId: 'LC-2847',
  consolidationLeg: 'LC-2847-B',
  issueType: 'REJECTED',
  affectedPallets: 2,
  returnDestination: 'Delhi ICD Terminal-3 — Return Bay R-04',
  instructions: [
    'Isolate pallets P3 and P4 from LC-2847-B at current position.',
    'Apply RETURN label from driver kit — red tag, scan QR code.',
    'Pallets LC-2847-A and LC-2847-C continue to Mumbai JNPT Gate-2.',
    'Return cargo to Delhi ICD Terminal-3, Bay R-04.',
    'Contact ground ops (+91-11-4567-8900) upon arrival for receipt.',
    'E-Way Bill Part B update in progress — do not depart return leg without confirmation.',
  ],
  unaffectedLegs: ['LC-2847-A', 'LC-2847-C'],
  documentationStatus: {
    returnInitiated: true,
    documentsPrepared: true,
    ewayBillPending: true,
    movementAssigned: false,
  },
};

// ──────────────────────────────────────────────────────────
// Demo Backhaul Offer
// ──────────────────────────────────────────────────────────

const _backhaulBase = 18500; // INR
export const DEMO_BACKHAUL_OFFER: BackhaulOffer = {
  offerId: 'BH-LC2847-001',
  currentRoute: { from: 'Delhi ICD', to: 'Mumbai JNPT' },
  backhaulRoute: { from: 'Mumbai JNPT', to: 'Surat ICD' },
  cargoWeightTonnes: 5.2,
  originalPrice: _backhaulBase,
  discountRate: BACKHAUL_DISCOUNT_RATE,
  discountedPrice: Math.round(_backhaulBase * (1 - BACKHAUL_DISCOUNT_RATE)),
  compatibilityReasons: [
    'Return route aligns with vehicle home depot.',
    'Cargo compatible: Industrial packaging, no hazmat.',
    'Pickup window matches estimated delivery + 3h buffer.',
    'Net positive contribution after fuel: ₹4,200 est.',
  ],
  expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
};
