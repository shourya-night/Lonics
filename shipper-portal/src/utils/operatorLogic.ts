/**
 * Lonics Operator Business Logic — Pure Functions
 *
 * All critical operator business logic lives here as pure, side-effect-free functions.
 * No React. No API calls. No state mutations.
 * This makes everything in this file fully unit-testable in isolation.
 *
 * Functions:
 *  - verifySeal()
 *  - authorizeOperatorRoute()
 *  - transitionShipmentStatus()
 *  - isolateRejectedCargo()
 *  - isBackhaulCompatible()
 *  - computeBackhaulPrice()
 *  - isGPSStale()
 */

import type { OperatorRole, ShipmentLifecycleStatus, OperationalEventType, BackhaulOffer } from '../types/operator';
import { GPS_STALE_THRESHOLD_SECONDS } from '../data/operatorDemoData';

// ──────────────────────────────────────────────────────────
// Seal Verification
// ──────────────────────────────────────────────────────────

/**
 * Compare an expected seal ID against a scanned or manually-entered seal ID.
 * Comparison is case-insensitive and trims whitespace.
 *
 * @returns 'VERIFIED' if seals match, 'MISMATCH' otherwise.
 */
export function verifySeal(expected: string, scanned: string): 'VERIFIED' | 'MISMATCH' {
  const normalize = (s: string) => s.trim().toUpperCase();
  return normalize(expected) === normalize(scanned) ? 'VERIFIED' : 'MISMATCH';
}

// ──────────────────────────────────────────────────────────
// Role-Based Route Authorization
// ──────────────────────────────────────────────────────────

type OperatorRoute = '/operators/driver' | '/operators/ground';

/**
 * Returns true if the given role is authorized to access the given operator route.
 *
 * DRIVER   → /operators/driver   ✓
 * DRIVER   → /operators/ground   ✗
 * GROUND_OPERATOR → /operators/ground ✓
 * GROUND_OPERATOR → /operators/driver ✗
 */
export function authorizeOperatorRoute(role: OperatorRole, route: OperatorRoute): boolean {
  if (role === 'DRIVER' && route === '/operators/driver') return true;
  if (role === 'GROUND_OPERATOR' && route === '/operators/ground') return true;
  return false;
}

// ──────────────────────────────────────────────────────────
// Shipment State Machine
// ──────────────────────────────────────────────────────────

/**
 * Valid forward transitions in the shipment lifecycle.
 * The map key is the CURRENT status, the value is the event that drives a transition,
 * and what that transition produces.
 */
const STATUS_TRANSITIONS: Partial<
  Record<ShipmentLifecycleStatus, Partial<Record<OperationalEventType, ShipmentLifecycleStatus>>>
> = {
  PENDING_PICKUP: {
    ARRIVED_AT_PICKUP: 'ARRIVED_AT_PICKUP',
  },
  ARRIVED_AT_PICKUP: {
    PICKUP_CONFIRMED: 'PICKUP_CONFIRMED',
  },
  PICKUP_CONFIRMED: {
    IN_TRANSIT: 'IN_TRANSIT',
  },
  IN_TRANSIT: {
    ARRIVED_AT_DROP: 'ARRIVED_AT_DROP',
  },
  ARRIVED_AT_DROP: {
    DELIVERY_CONFIRMED: 'DELIVERY_CONFIRMED',
    CARGO_RECEIVED: 'DELIVERY_CONFIRMED',
  },
  DELIVERY_CONFIRMED: {
    // Terminal state — no outgoing transitions
  },
};

/**
 * Transition a shipment from its current status given an operator event.
 *
 * @returns The next ShipmentLifecycleStatus, or null if the transition is invalid.
 *
 * @example
 *   transitionShipmentStatus('PENDING_PICKUP', 'ARRIVED_AT_PICKUP') → 'ARRIVED_AT_PICKUP'
 *   transitionShipmentStatus('PENDING_PICKUP', 'DELIVERY_CONFIRMED') → null  (invalid skip)
 */
export function transitionShipmentStatus(
  current: ShipmentLifecycleStatus,
  event: OperationalEventType
): ShipmentLifecycleStatus | null {
  const allowed = STATUS_TRANSITIONS[current];
  if (!allowed) return null;
  return allowed[event] ?? null;
}

// ──────────────────────────────────────────────────────────
// Cargo Isolation (for Return Exchange)
// ──────────────────────────────────────────────────────────

/**
 * Given a list of consolidated cargo legs and the ID of a rejected leg,
 * separate the legs into those that continue and those that must be returned.
 *
 * Only the rejected leg is isolated. All other legs continue.
 *
 * @param legs - All leg IDs in the consolidated container.
 * @param rejectedLeg - The specific leg ID that was rejected/damaged.
 * @returns { continue: string[], return: string[] }
 *
 * @example
 *   isolateRejectedCargo(['LC-2847-A', 'LC-2847-B', 'LC-2847-C'], 'LC-2847-B')
 *   → { continue: ['LC-2847-A', 'LC-2847-C'], return: ['LC-2847-B'] }
 */
export function isolateRejectedCargo(
  legs: string[],
  rejectedLeg: string
): { continue: string[]; return: string[] } {
  const continueLeg = legs.filter((l) => l !== rejectedLeg);
  const returnLeg = legs.filter((l) => l === rejectedLeg);
  return { continue: continueLeg, return: returnLeg };
}

// ──────────────────────────────────────────────────────────
// Backhaul Compatibility & Pricing
// ──────────────────────────────────────────────────────────

/**
 * Evaluate whether a driver's current truck route is compatible with a backhaul offer.
 *
 * Compatibility rules:
 * 1. The backhaul pickup location must match the driver's current destination.
 * 2. The offer must not be expired.
 *
 * @returns { compatible: boolean; reasons: string[] }
 */
export function isBackhaulCompatible(
  currentRoute: { from: string; to: string },
  offer: BackhaulOffer
): { compatible: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Rule 1: Backhaul pickup must be where the driver is going
  const routeMatch =
    offer.backhaulRoute.from.toLowerCase().trim() ===
    currentRoute.to.toLowerCase().trim();

  if (!routeMatch) {
    reasons.push(
      `Backhaul pickup (${offer.backhaulRoute.from}) does not match current drop-off (${currentRoute.to}).`
    );
  }

  // Rule 2: Offer must not be expired
  const now = new Date();
  const expiry = new Date(offer.expiresAt);
  const isExpired = expiry <= now;
  if (isExpired) {
    reasons.push(`Backhaul offer expired at ${expiry.toLocaleTimeString()}.`);
  }

  const compatible = routeMatch && !isExpired;
  if (compatible) {
    reasons.push(...offer.compatibilityReasons);
  }

  return { compatible, reasons };
}

/**
 * Compute the discounted backhaul price.
 *
 * @param originalPrice - The original freight price in INR.
 * @param discountRate - Fractional discount e.g. 0.40 = 40% off.
 * @returns Discounted price rounded to nearest rupee.
 */
export function computeBackhaulPrice(originalPrice: number, discountRate: number): number {
  return Math.round(originalPrice * (1 - discountRate));
}

// ──────────────────────────────────────────────────────────
// GPS Staleness
// ──────────────────────────────────────────────────────────

/**
 * Determine whether a GPS update is stale (too old to be reliable).
 *
 * @param timestamp - ISO 8601 timestamp of the GPS fix.
 * @param thresholdSeconds - How many seconds until stale. Default: GPS_STALE_THRESHOLD_SECONDS (60s).
 * @returns true if the update is older than thresholdSeconds, false otherwise.
 */
export function isGPSStale(
  timestamp: string,
  thresholdSeconds: number = GPS_STALE_THRESHOLD_SECONDS
): boolean {
  const fixTime = new Date(timestamp).getTime();
  const nowMs = Date.now();
  const ageMs = nowMs - fixTime;
  return ageMs > thresholdSeconds * 1000;
}
