/**
 * Lonics Return Exchange Agent — Shared State Service
 *
 * This is the SINGLE authoritative source for return and backhaul state.
 * All three surfaces consume from this service:
 *   - Mission Control: reads RETURN_EXCHANGE_NODE status (read-only)
 *   - Driver Dashboard: reads backhaul offers, accepts/declines
 *   - Ground Ops Dashboard: triggers return isolation, reads return actions
 *
 * MissionControlDeck.tsx does NOT own or manage this state.
 * Agent logic is service-based, not component-based.
 */

import { supabase } from '../lib/supabase';
import { publishOperationalEvent } from './operationalEvents';
import { isBackhaulCompatible, computeBackhaulPrice } from '../utils/operatorLogic';
import {
  DEMO_RETURN_ACTION,
  DEMO_BACKHAUL_OFFER,
  BACKHAUL_DISCOUNT_RATE,
} from '../data/operatorDemoData';
import type { ReturnAction, BackhaulOffer, OperatorRole } from '../types/operator';

// ──────────────────────────────────────────────────────────
// In-Memory State (demo / until Supabase tables confirmed)
// ──────────────────────────────────────────────────────────
//
// In production, this state would be fetched from Supabase and
// kept in sync via Realtime subscriptions. For the demo, the initial
// state is seeded from operatorDemoData.ts.
//
// The state is module-level so it persists across component re-mounts
// within the same session (tab).

interface ReturnExchangeState {
  returnActions: Record<string, ReturnAction>;  // keyed by shipmentId
  backhaulOffers: Record<string, BackhaulOffer>;  // keyed by offerId
  declinedOfferIds: Set<string>;
}

const _state: ReturnExchangeState = {
  returnActions: {
    'LC-2847': DEMO_RETURN_ACTION,
  },
  backhaulOffers: {
    'BH-LC2847-001': DEMO_BACKHAUL_OFFER,
  },
  declinedOfferIds: new Set(),
};

// ──────────────────────────────────────────────────────────
// Return Actions
// ──────────────────────────────────────────────────────────

/**
 * Get the current return action for a given shipment, if any.
 * Returns null if no return workflow is active for this shipment.
 */
export function getReturnActions(shipmentId: string): ReturnAction | null {
  return _state.returnActions[shipmentId] ?? null;
}

/**
 * Set or update a return action for a shipment.
 * Used internally when `initiateReturn()` is called.
 */
function _setReturnAction(action: ReturnAction): void {
  _state.returnActions[action.shipmentId] = action;
}

// ──────────────────────────────────────────────────────────
// Backhaul Offers
// ──────────────────────────────────────────────────────────

/**
 * Get all active (non-declined, non-expired) backhaul offers compatible with a driver's current route.
 *
 * @param currentRoute - The driver's current { from, to } route.
 * @returns Array of compatible BackhaulOffer objects.
 */
export function getBackhaulOffers(
  currentRoute: { from: string; to: string }
): BackhaulOffer[] {
  const now = new Date();
  return Object.values(_state.backhaulOffers).filter((offer) => {
    // Skip declined
    if (_state.declinedOfferIds.has(offer.offerId)) return false;
    // Skip expired
    if (new Date(offer.expiresAt) <= now) return false;
    // Check compatibility
    const { compatible } = isBackhaulCompatible(currentRoute, offer);
    return compatible;
  });
}

/**
 * Accept a backhaul offer on behalf of a driver.
 *
 * Validates:
 * 1. Offer exists and hasn't been declined.
 * 2. Offer is still valid (not expired).
 *
 * @returns 'ACCEPTED' if successful, 'INVALID' if offer is invalid/expired/declined.
 */
export async function acceptBackhaul(
  offerId: string,
  driverId: string
): Promise<'ACCEPTED' | 'INVALID'> {
  const offer = _state.backhaulOffers[offerId];
  if (!offer) return 'INVALID';
  if (_state.declinedOfferIds.has(offerId)) return 'INVALID';
  if (new Date(offer.expiresAt) <= new Date()) return 'INVALID';

  // Publish acceptance event
  await publishOperationalEvent({
    eventType: 'BACKHAUL_ACCEPTED',
    shipmentId: offer.offerId,
    operatorId: driverId,
    location: offer.backhaulRoute.from,
    timestamp: new Date().toISOString(),
    metadata: {
      offerId,
      backhaulRoute: offer.backhaulRoute,
      discountedPrice: offer.discountedPrice,
      discountRate: offer.discountRate,
    },
  });

  console.log(`[ReturnExchangeAgent] ✓ Backhaul ${offerId} accepted by driver ${driverId}`);

  // Try persisting to Supabase
  try {
    await supabase.from('operator_events').insert({
      event_type: 'BACKHAUL_ACCEPTED',
      shipment_id: offerId,
      operator_id: driverId,
      location: offer.backhaulRoute.from,
      timestamp: new Date().toISOString(),
      metadata: { offerId, backhaulRoute: offer.backhaulRoute },
    });
  } catch {
    // Graceful fallback — table may not exist in dev
  }

  return 'ACCEPTED';
}

/**
 * Decline a backhaul offer. The offer will no longer be returned by getBackhaulOffers().
 */
export async function declineBackhaul(offerId: string, driverId: string): Promise<void> {
  _state.declinedOfferIds.add(offerId);

  const offer = _state.backhaulOffers[offerId];

  await publishOperationalEvent({
    eventType: 'BACKHAUL_DECLINED',
    shipmentId: offerId,
    operatorId: driverId,
    location: offer?.backhaulRoute.from ?? 'Unknown',
    timestamp: new Date().toISOString(),
    metadata: { offerId },
  });

  console.log(`[ReturnExchangeAgent] Backhaul ${offerId} declined by driver ${driverId}`);
}

// ──────────────────────────────────────────────────────────
// Return Isolation
// ──────────────────────────────────────────────────────────

/**
 * Initiate a cargo return workflow for a specific leg.
 *
 * This:
 * 1. Stores the ReturnAction in module state.
 * 2. Publishes a RETURN_INITIATED operational event.
 * 3. Automatically creates a backhaul offer for the return leg (at configured discount).
 *
 * @param action - The ReturnAction describing the isolation and return instructions.
 * @param operatorId - The ground operator or driver initiating the return.
 */
export async function initiateReturn(
  action: ReturnAction,
  operatorId: string
): Promise<void> {
  _setReturnAction(action);

  await publishOperationalEvent({
    eventType: 'RETURN_INITIATED',
    shipmentId: action.shipmentId,
    operatorId,
    location: action.returnDestination,
    timestamp: new Date().toISOString(),
    metadata: {
      consolidationLeg: action.consolidationLeg,
      issueType: action.issueType,
      affectedPallets: action.affectedPallets,
      unaffectedLegs: action.unaffectedLegs,
    },
  });

  console.log(`[ReturnExchangeAgent] ✓ Return initiated for ${action.consolidationLeg}`);

  // Auto-generate backhaul offer for return leg
  const returnOfferId = `BH-RETURN-${action.consolidationLeg}-${Date.now()}`;
  const basePrice = 12000; // INR — placeholder, would be computed from route engine in prod
  const returnOffer: BackhaulOffer = {
    offerId: returnOfferId,
    currentRoute: { from: action.returnDestination, to: 'Delhi ICD Terminal-3' },
    backhaulRoute: { from: action.returnDestination, to: 'Delhi ICD Terminal-3' },
    cargoWeightTonnes: action.affectedPallets * 1.2, // rough estimate
    originalPrice: basePrice,
    discountRate: BACKHAUL_DISCOUNT_RATE,
    discountedPrice: computeBackhaulPrice(basePrice, BACKHAUL_DISCOUNT_RATE),
    compatibilityReasons: [
      `Return leg: ${action.consolidationLeg} to Delhi ICD.`,
      `Affected pallets: ${action.affectedPallets}.`,
      'Auto-offered at configured backhaul discount rate.',
    ],
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4h window
  };

  _state.backhaulOffers[returnOfferId] = returnOffer;

  await publishOperationalEvent({
    eventType: 'BACKHAUL_OFFERED',
    shipmentId: action.shipmentId,
    operatorId: 'RETURN_EXCHANGE_NODE',
    location: action.returnDestination,
    timestamp: new Date().toISOString(),
    metadata: { offerId: returnOfferId, returnOffer },
  });
}

// ──────────────────────────────────────────────────────────
// Utility: compute backhaul price (re-exported for convenience)
// ──────────────────────────────────────────────────────────

export { computeBackhaulPrice, BACKHAUL_DISCOUNT_RATE };
export type { OperatorRole };
