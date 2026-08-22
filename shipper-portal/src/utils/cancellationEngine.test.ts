/**
 * Unit Tests for Lonics Cancellation & Refund Engine
 * 
 * Verifies route-level cancellation logic, dynamic refund formulas,
 * leg status classifications, and edge case behaviors.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateCancellationRefund,
  formatINR,
  CANCELLATION_RATES,
} from './cancellationEngine';

describe('cancellationEngine', () => {
  it('calculates pre-departure full booking refund correctly (~90% refundable)', () => {
    const result = calculateCancellationRefund({
      bookingId: 'BK-1001',
      origin: 'Mumbai Port DFC Gate-1',
      destination: 'Delhi ICD Terminal-3',
      totalAmount: 10000,
      status: 'RESERVATION_INITIATED',
      transitProgress: 10,
    });

    expect(result.bookingId).toBe('BK-1001');
    expect(result.totalBookingAmount).toBe(10000);
    expect(result.canExecuteCancellation).toBe(true);
    expect(result.cancellableLegsCount).toBe(3);
    expect(result.nonCancellableLegsCount).toBe(0);

    // First mile: 2000 * 0.10 deduction = 200 -> 1800 refund
    // Line haul: 6500 * 0.10 deduction = 650 -> 5850 refund
    // Last mile: 1500 * 0.00 deduction = 0 -> 1500 refund
    // Total refund: 1800 + 5850 + 1500 = 9150
    expect(result.totalDeductions).toBe(850);
    expect(result.estimatedRefund).toBe(9150);
    expect(result.refundPercentage).toBe(92);
  });

  it('calculates mid-transit booking refund (first mile done, rail active, last mile pending)', () => {
    const result = calculateCancellationRefund({
      bookingId: 'BK-2002',
      origin: 'Mumbai Port DFC Gate-1',
      destination: 'Delhi ICD Terminal-3',
      totalAmount: 12500,
      status: 'IN_TRANSIT',
      transitProgress: 65,
    });

    expect(result.bookingId).toBe('BK-2002');
    expect(result.canExecuteCancellation).toBe(true);
    expect(result.legs.length).toBe(3);

    // Leg 1 (first mile): Completed -> 0 refund, 100% deduction
    const leg1 = result.legs[0];
    expect(leg1.status).toBe('COMPLETED');
    expect(leg1.isCancelable).toBe(false);
    expect(leg1.refundableAmount).toBe(0);

    // Leg 2 (line-haul rail): In transit (> 50%) -> 50% deduction
    const leg2 = result.legs[1];
    expect(leg2.status).toBe('IN_TRANSIT');
    expect(leg2.isCancelable).toBe(true);
    expect(leg2.deductionRate).toBe(CANCELLATION_RATES.MID_TRANSIT_DEDUCTION_RATE);

    // Leg 3 (last-mile): Uncommenced -> 100% refundable
    const leg3 = result.legs[2];
    expect(leg3.status).toBe('SCHEDULED');
    expect(leg3.isCancelable).toBe(true);
    expect(leg3.refundableAmount).toBe(leg3.legAmount);

    expect(result.estimatedRefund).toBeGreaterThan(0);
    expect(result.estimatedRefund).toBeLessThan(12500);
    expect(result.totalBookingAmount - result.totalDeductions).toBe(result.estimatedRefund);
  });

  it('disallows cancellation for already delivered bookings', () => {
    const result = calculateCancellationRefund({
      bookingId: 'BK-3003',
      origin: 'Mumbai Port',
      destination: 'Delhi ICD',
      totalAmount: 15000,
      status: 'DELIVERED',
      transitProgress: 100,
    });

    expect(result.canExecuteCancellation).toBe(false);
    expect(result.estimatedRefund).toBe(0);
    expect(result.totalDeductions).toBe(15000);
    expect(result.cancellableLegsCount).toBe(0);
    expect(result.nonCancellableLegsCount).toBe(3);
  });

  it('handles already cancelled status gracefully', () => {
    const result = calculateCancellationRefund({
      bookingId: 'BK-4004',
      origin: 'Mumbai Port',
      destination: 'Delhi ICD',
      totalAmount: 10000,
      status: 'CANCELLED',
      transitProgress: 0,
    });

    expect(result.canExecuteCancellation).toBe(false);
  });

  it('formats currency correctly with formatINR', () => {
    expect(formatINR(12500)).toBe('₹12,500');
    expect(formatINR(0)).toBe('₹0');
    expect(formatINR(1054320)).toBe('₹10,54,320');
  });
});
