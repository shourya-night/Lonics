/**
 * Unit tests for Lonics Operator Business Logic
 *
 * Covers all 6 business-critical operator scenarios:
 * 1. Seal verification
 * 2. Role-based route authorization
 * 3. Shipment lifecycle state machine
 * 4. Cargo isolation for Return Exchange
 * 5. Backhaul compatibility + pricing
 * 6. GPS staleness detection
 *
 * Run: npx vitest run src/utils/operatorLogic.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  verifySeal,
  authorizeOperatorRoute,
  transitionShipmentStatus,
  isolateRejectedCargo,
  isBackhaulCompatible,
  computeBackhaulPrice,
  isGPSStale,
} from './operatorLogic';
import type { BackhaulOffer } from '../types/operator';
import { BACKHAUL_DISCOUNT_RATE } from '../data/operatorDemoData';

// ──────────────────────────────────────────────────────────
// 1. Seal Verification
// ──────────────────────────────────────────────────────────

describe('verifySeal', () => {
  it('returns VERIFIED when seals match exactly', () => {
    expect(verifySeal('SEAL-839201', 'SEAL-839201')).toBe('VERIFIED');
  });

  it('returns VERIFIED when seals match case-insensitively', () => {
    expect(verifySeal('seal-839201', 'SEAL-839201')).toBe('VERIFIED');
    expect(verifySeal('SEAL-839201', 'seal-839201')).toBe('VERIFIED');
  });

  it('returns VERIFIED when seals match with surrounding whitespace', () => {
    expect(verifySeal('  SEAL-839201  ', 'SEAL-839201')).toBe('VERIFIED');
    expect(verifySeal('SEAL-839201', '  SEAL-839201  ')).toBe('VERIFIED');
  });

  it('returns MISMATCH when seal IDs differ', () => {
    expect(verifySeal('SEAL-839201', 'SEAL-000000')).toBe('MISMATCH');
  });

  it('returns MISMATCH on partial match', () => {
    expect(verifySeal('SEAL-839201', 'SEAL-839')).toBe('MISMATCH');
  });

  it('returns MISMATCH on empty scanned input', () => {
    expect(verifySeal('SEAL-839201', '')).toBe('MISMATCH');
  });
});

// ──────────────────────────────────────────────────────────
// 2. Role-Based Route Authorization
// ──────────────────────────────────────────────────────────

describe('authorizeOperatorRoute', () => {
  it('authorizes DRIVER to /operators/driver', () => {
    expect(authorizeOperatorRoute('DRIVER', '/operators/driver')).toBe(true);
  });

  it('blocks DRIVER from /operators/ground', () => {
    expect(authorizeOperatorRoute('DRIVER', '/operators/ground')).toBe(false);
  });

  it('authorizes GROUND_OPERATOR to /operators/ground', () => {
    expect(authorizeOperatorRoute('GROUND_OPERATOR', '/operators/ground')).toBe(true);
  });

  it('blocks GROUND_OPERATOR from /operators/driver', () => {
    expect(authorizeOperatorRoute('GROUND_OPERATOR', '/operators/driver')).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────
// 3. Shipment Lifecycle State Machine
// ──────────────────────────────────────────────────────────

describe('transitionShipmentStatus', () => {
  it('transitions PENDING_PICKUP → ARRIVED_AT_PICKUP on ARRIVED_AT_PICKUP event', () => {
    expect(transitionShipmentStatus('PENDING_PICKUP', 'ARRIVED_AT_PICKUP')).toBe('ARRIVED_AT_PICKUP');
  });

  it('transitions ARRIVED_AT_PICKUP → PICKUP_CONFIRMED on PICKUP_CONFIRMED event', () => {
    expect(transitionShipmentStatus('ARRIVED_AT_PICKUP', 'PICKUP_CONFIRMED')).toBe('PICKUP_CONFIRMED');
  });

  it('transitions PICKUP_CONFIRMED → IN_TRANSIT on IN_TRANSIT event', () => {
    expect(transitionShipmentStatus('PICKUP_CONFIRMED', 'IN_TRANSIT')).toBe('IN_TRANSIT');
  });

  it('transitions IN_TRANSIT → ARRIVED_AT_DROP on ARRIVED_AT_DROP event', () => {
    expect(transitionShipmentStatus('IN_TRANSIT', 'ARRIVED_AT_DROP')).toBe('ARRIVED_AT_DROP');
  });

  it('transitions ARRIVED_AT_DROP → DELIVERY_CONFIRMED on DELIVERY_CONFIRMED event', () => {
    expect(transitionShipmentStatus('ARRIVED_AT_DROP', 'DELIVERY_CONFIRMED')).toBe('DELIVERY_CONFIRMED');
  });

  it('transitions ARRIVED_AT_DROP → DELIVERY_CONFIRMED on CARGO_RECEIVED event (ground op)', () => {
    expect(transitionShipmentStatus('ARRIVED_AT_DROP', 'CARGO_RECEIVED')).toBe('DELIVERY_CONFIRMED');
  });

  it('returns null for invalid skip (PENDING_PICKUP → DELIVERY_CONFIRMED)', () => {
    expect(transitionShipmentStatus('PENDING_PICKUP', 'DELIVERY_CONFIRMED')).toBeNull();
  });

  it('returns null for backward transition (IN_TRANSIT → ARRIVED_AT_PICKUP)', () => {
    expect(transitionShipmentStatus('IN_TRANSIT', 'ARRIVED_AT_PICKUP')).toBeNull();
  });

  it('returns null for terminal state transitions (DELIVERY_CONFIRMED → anything)', () => {
    expect(transitionShipmentStatus('DELIVERY_CONFIRMED', 'ARRIVED_AT_DROP')).toBeNull();
    expect(transitionShipmentStatus('DELIVERY_CONFIRMED', 'IN_TRANSIT')).toBeNull();
  });

  it('returns null for non-lifecycle events on lifecycle states', () => {
    expect(transitionShipmentStatus('IN_TRANSIT', 'SEAL_MISMATCH')).toBeNull();
    expect(transitionShipmentStatus('PENDING_PICKUP', 'BACKHAUL_ACCEPTED')).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────
// 4. Cargo Isolation (Return Exchange)
// ──────────────────────────────────────────────────────────

describe('isolateRejectedCargo', () => {
  it('isolates middle leg and continues outer legs', () => {
    const result = isolateRejectedCargo(
      ['LC-2847-A', 'LC-2847-B', 'LC-2847-C'],
      'LC-2847-B'
    );
    expect(result.continue).toEqual(['LC-2847-A', 'LC-2847-C']);
    expect(result.return).toEqual(['LC-2847-B']);
  });

  it('isolates first leg and continues the rest', () => {
    const result = isolateRejectedCargo(
      ['LC-2847-A', 'LC-2847-B', 'LC-2847-C'],
      'LC-2847-A'
    );
    expect(result.continue).toEqual(['LC-2847-B', 'LC-2847-C']);
    expect(result.return).toEqual(['LC-2847-A']);
  });

  it('returns all legs in continue when rejected leg is not in list', () => {
    const result = isolateRejectedCargo(
      ['LC-2847-A', 'LC-2847-B'],
      'LC-2847-Z'
    );
    expect(result.continue).toEqual(['LC-2847-A', 'LC-2847-B']);
    expect(result.return).toEqual([]);
  });

  it('handles single-leg container rejection', () => {
    const result = isolateRejectedCargo(['LC-2847-A'], 'LC-2847-A');
    expect(result.continue).toEqual([]);
    expect(result.return).toEqual(['LC-2847-A']);
  });
});

// ──────────────────────────────────────────────────────────
// 5. Backhaul Compatibility + Pricing
// ──────────────────────────────────────────────────────────

const futureExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
const pastExpiry = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

const compatibleOffer: BackhaulOffer = {
  offerId: 'BH-001',
  currentRoute: { from: 'Delhi ICD', to: 'Mumbai JNPT' },
  backhaulRoute: { from: 'Mumbai JNPT', to: 'Surat ICD' },
  cargoWeightTonnes: 5.2,
  originalPrice: 18500,
  discountRate: BACKHAUL_DISCOUNT_RATE,
  discountedPrice: 11100,
  compatibilityReasons: ['Route aligns with home depot.'],
  expiresAt: futureExpiry,
};

describe('isBackhaulCompatible', () => {
  it('returns compatible=true when pickup matches current drop and offer is not expired', () => {
    const result = isBackhaulCompatible(
      { from: 'Delhi ICD', to: 'Mumbai JNPT' },
      compatibleOffer
    );
    expect(result.compatible).toBe(true);
    expect(result.reasons).toContain('Route aligns with home depot.');
  });

  it('returns compatible=false when pickup does not match current drop-off', () => {
    const result = isBackhaulCompatible(
      { from: 'Delhi ICD', to: 'Surat ICD' },  // driver going to Surat, not Mumbai
      compatibleOffer
    );
    expect(result.compatible).toBe(false);
    expect(result.reasons[0]).toContain('does not match');
  });

  it('returns compatible=false when offer is expired', () => {
    const expiredOffer: BackhaulOffer = { ...compatibleOffer, expiresAt: pastExpiry };
    const result = isBackhaulCompatible(
      { from: 'Delhi ICD', to: 'Mumbai JNPT' },
      expiredOffer
    );
    expect(result.compatible).toBe(false);
    expect(result.reasons.some((r) => r.includes('expired'))).toBe(true);
  });
});

describe('computeBackhaulPrice', () => {
  it('computes 40% discount correctly', () => {
    expect(computeBackhaulPrice(18500, 0.40)).toBe(11100);
  });

  it('computes 50% discount correctly', () => {
    expect(computeBackhaulPrice(10000, 0.50)).toBe(5000);
  });

  it('returns original price at 0% discount', () => {
    expect(computeBackhaulPrice(15000, 0)).toBe(15000);
  });

  it('uses the configurable BACKHAUL_DISCOUNT_RATE constant correctly', () => {
    const price = 18500;
    const result = computeBackhaulPrice(price, BACKHAUL_DISCOUNT_RATE);
    expect(result).toBe(Math.round(price * (1 - BACKHAUL_DISCOUNT_RATE)));
  });
});

// ──────────────────────────────────────────────────────────
// 6. GPS Staleness
// ──────────────────────────────────────────────────────────

describe('isGPSStale', () => {
  it('returns false for a fresh timestamp (now)', () => {
    const now = new Date().toISOString();
    expect(isGPSStale(now)).toBe(false);
  });

  it('returns false for a 30-second-old timestamp (within 60s threshold)', () => {
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    expect(isGPSStale(thirtySecondsAgo)).toBe(false);
  });

  it('returns true for a 61-second-old timestamp (beyond 60s threshold)', () => {
    const sixtyOneSecondsAgo = new Date(Date.now() - 61 * 1000).toISOString();
    expect(isGPSStale(sixtyOneSecondsAgo)).toBe(true);
  });

  it('returns true for a 5-minute-old timestamp', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(isGPSStale(fiveMinutesAgo)).toBe(true);
  });

  it('respects a custom threshold', () => {
    const twentySecondsAgo = new Date(Date.now() - 20 * 1000).toISOString();
    expect(isGPSStale(twentySecondsAgo, 10)).toBe(true);   // 20s > 10s threshold
    expect(isGPSStale(twentySecondsAgo, 30)).toBe(false);  // 20s < 30s threshold
  });
});
