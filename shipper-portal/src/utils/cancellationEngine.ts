/**
 * Lonics Canonical Freight Cancellation & Refund Engine
 * 
 * Deterministically computes route-level cancellation eligibility, operational
 * deductions, and dynamic refund amounts for multimodal Indian freight bookings.
 * 
 * Follows transparent, IRCTC-inspired railway freight rules tailored for Lonics
 * LCL consolidation & Container Train Operator (CTO) block reservations.
 */

export type TransportMode = 'ROAD' | 'RAIL' | 'E_LCV';

export type LegStatus = 'SCHEDULED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';

export interface BookedLeg {
  id: string;
  name: string;
  from: string;
  to: string;
  mode: TransportMode;
  scheduledDeparture: string;
  legAmount: number;
  status: LegStatus;
  isCancelable: boolean;
  deductionRate: number; // e.g. 0.10 for 10%
  deductionAmount: number;
  refundableAmount: number;
  statusLabel: string;
  explanation: string;
}

export interface CancellationRefundSummary {
  bookingId: string;
  origin: string;
  destination: string;
  totalBookingAmount: number;
  totalDeductions: number;
  estimatedRefund: number;
  refundPercentage: number;
  legs: BookedLeg[];
  cancellableLegsCount: number;
  nonCancellableLegsCount: number;
  canExecuteCancellation: boolean;
  cancellationReason?: string;
  policyNotes: string[];
  calculatedAt: string;
}

export interface CalculateCancellationParams {
  bookingId: string;
  origin?: string;
  destination?: string;
  totalAmount?: number;
  status?: string;
  transitProgress?: number;
  assignedWindowId?: string;
}

/**
 * Standard baseline cancellation policy rates
 */
export const CANCELLATION_RATES = {
  // Pre-departure / unassigned / reservation initiated: 10% administrative & CTO reservation fee
  PRE_DEPARTURE_DEDUCTION_RATE: 0.10,
  // Early transit / within cutoff window (< 4 hours): 30% CTO slot hold penalty
  EARLY_TRANSIT_DEDUCTION_RATE: 0.30,
  // Mid-transit active line haul: 50% operational reservation penalty
  MID_TRANSIT_DEDUCTION_RATE: 0.50,
  // Completed / delivered leg: Non-refundable (100% deduction)
  COMPLETED_DEDUCTION_RATE: 1.00,
  // Uncommenced last-mile leg: 0% deduction (100% refund)
  UNCOMMENCED_LAST_MILE_DEDUCTION_RATE: 0.00,
};

/**
 * Calculates dynamic route-level refund breakdown for any Lonics freight booking.
 */
export function calculateCancellationRefund(
  params: CalculateCancellationParams
): CancellationRefundSummary {
  const {
    bookingId,
    origin = 'Mumbai Port DFC Gate-1',
    destination = 'Delhi ICD Terminal-3',
    totalAmount = 12500,
    status = 'IN_TRANSIT',
    transitProgress = 65,
  } = params;

  const isAlreadyCancelled = status === 'CANCELLED' || transitProgress === 0;
  const isDelivered = status === 'DELIVERED' || transitProgress >= 100;

  // Multi-leg breakdown allocation weights
  // First-mile feeder: 20%, Line-haul Rail DFC: 65%, Last-mile e-LCV: 15%
  const firstMileAmount = Math.round(totalAmount * 0.20);
  const lineHaulAmount = Math.round(totalAmount * 0.65);
  const lastMileAmount = totalAmount - firstMileAmount - lineHaulAmount; // balance

  const now = new Date();
  const formatTime = (hoursAhead: number) => {
    const d = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const legs: BookedLeg[] = [];

  // ──────────────────────────────────────────────────────────
  // LEG 1: First-Mile Feeder (Origin -> Gateway ICD / Terminal)
  // ──────────────────────────────────────────────────────────
  if (transitProgress >= 30 || isDelivered) {
    // First mile is already executed
    legs.push({
      id: 'leg-1-first-mile',
      name: 'First-Mile Feeder Trucking',
      from: origin,
      to: 'Dadri ICD Gateway',
      mode: 'ROAD',
      scheduledDeparture: formatTime(-4),
      legAmount: firstMileAmount,
      status: 'COMPLETED',
      isCancelable: false,
      deductionRate: CANCELLATION_RATES.COMPLETED_DEDUCTION_RATE,
      deductionAmount: firstMileAmount,
      refundableAmount: 0,
      statusLabel: 'Completed',
      explanation: 'Feeder pickup completed and verified at origin gate.',
    });
  } else {
    // First mile is scheduled / pending
    const deduction = Math.round(firstMileAmount * CANCELLATION_RATES.PRE_DEPARTURE_DEDUCTION_RATE);
    legs.push({
      id: 'leg-1-first-mile',
      name: 'First-Mile Feeder Trucking',
      from: origin,
      to: 'Dadri ICD Gateway',
      mode: 'ROAD',
      scheduledDeparture: formatTime(1),
      legAmount: firstMileAmount,
      status: 'SCHEDULED',
      isCancelable: true,
      deductionRate: CANCELLATION_RATES.PRE_DEPARTURE_DEDUCTION_RATE,
      deductionAmount: deduction,
      refundableAmount: firstMileAmount - deduction,
      statusLabel: 'Eligible for Cancellation',
      explanation: 'Uncommenced feeder leg — 10% booking reservation fee deducted.',
    });
  }

  // ──────────────────────────────────────────────────────────
  // LEG 2: Line-Haul Rail DFC Corridor
  // ──────────────────────────────────────────────────────────
  if (isDelivered) {
    legs.push({
      id: 'leg-2-line-haul-rail',
      name: 'Line-Haul Heavy Freight Rail (DFC)',
      from: 'Dadri ICD Gateway',
      to: destination.includes('Delhi') ? 'Delhi ICD Terminal-3' : destination,
      mode: 'RAIL',
      scheduledDeparture: formatTime(-2),
      legAmount: lineHaulAmount,
      status: 'COMPLETED',
      isCancelable: false,
      deductionRate: CANCELLATION_RATES.COMPLETED_DEDUCTION_RATE,
      deductionAmount: lineHaulAmount,
      refundableAmount: 0,
      statusLabel: 'Delivered',
      explanation: 'Line-haul transit completed and arrived at destination rail terminal.',
    });
  } else if (status === 'IN_TRANSIT' || status === 'REROUTED_GRAP_ACTIVE' || transitProgress > 20) {
    // Currently on train / active line-haul dispatch
    // In Lonics, mid-transit cancellation allows backhaul slot salvage at 50% deduction
    const deductionRate = transitProgress > 50 
      ? CANCELLATION_RATES.MID_TRANSIT_DEDUCTION_RATE 
      : CANCELLATION_RATES.EARLY_TRANSIT_DEDUCTION_RATE;
    const deduction = Math.round(lineHaulAmount * deductionRate);
    legs.push({
      id: 'leg-2-line-haul-rail',
      name: 'Line-Haul Heavy Freight Rail (DFC)',
      from: 'Dadri ICD Gateway',
      to: destination.includes('Delhi') ? 'Delhi ICD Terminal-3' : destination,
      mode: 'RAIL',
      scheduledDeparture: formatTime(0),
      legAmount: lineHaulAmount,
      status: 'IN_TRANSIT',
      isCancelable: true,
      deductionRate: deductionRate,
      deductionAmount: deduction,
      refundableAmount: lineHaulAmount - deduction,
      statusLabel: 'In Transit (Partial Refund)',
      explanation: `Active DFC train dispatch (${transitProgress.toFixed(0)}% progress). ${Math.round(deductionRate * 100)}% CTO container allocation fee applies; released slot re-auctioned.`,
    });
  } else {
    // Pre-departure rail block
    const deduction = Math.round(lineHaulAmount * CANCELLATION_RATES.PRE_DEPARTURE_DEDUCTION_RATE);
    legs.push({
      id: 'leg-2-line-haul-rail',
      name: 'Line-Haul Heavy Freight Rail (DFC)',
      from: 'Dadri ICD Gateway',
      to: destination.includes('Delhi') ? 'Delhi ICD Terminal-3' : destination,
      mode: 'RAIL',
      scheduledDeparture: formatTime(3),
      legAmount: lineHaulAmount,
      status: 'SCHEDULED',
      isCancelable: true,
      deductionRate: CANCELLATION_RATES.PRE_DEPARTURE_DEDUCTION_RATE,
      deductionAmount: deduction,
      refundableAmount: lineHaulAmount - deduction,
      statusLabel: 'Eligible for Cancellation',
      explanation: 'Advance container booking — 90% refundable upon cancellation.',
    });
  }

  // ──────────────────────────────────────────────────────────
  // LEG 3: Last-Mile Urban Delivery / E-LCV Distribution
  // ──────────────────────────────────────────────────────────
  if (isDelivered) {
    legs.push({
      id: 'leg-3-last-mile',
      name: 'Last-Mile E-LCV Delivery',
      from: 'Delhi ICD Terminal-3',
      to: 'Consignee Delivery Bay',
      mode: 'E_LCV',
      scheduledDeparture: formatTime(-1),
      legAmount: lastMileAmount,
      status: 'COMPLETED',
      isCancelable: false,
      deductionRate: CANCELLATION_RATES.COMPLETED_DEDUCTION_RATE,
      deductionAmount: lastMileAmount,
      refundableAmount: 0,
      statusLabel: 'Completed',
      explanation: 'Consignment handed over at destination gate.',
    });
  } else {
    // Last-mile has not commenced yet -> 100% refundable
    legs.push({
      id: 'leg-3-last-mile',
      name: 'Last-Mile E-LCV Delivery',
      from: 'Delhi ICD Terminal-3',
      to: 'Consignee Delivery Bay',
      mode: 'E_LCV',
      scheduledDeparture: formatTime(6),
      legAmount: lastMileAmount,
      status: 'SCHEDULED',
      isCancelable: true,
      deductionRate: CANCELLATION_RATES.UNCOMMENCED_LAST_MILE_DEDUCTION_RATE,
      deductionAmount: 0,
      refundableAmount: lastMileAmount,
      statusLabel: '100% Refundable',
      explanation: 'Uncommenced delivery leg — 100% refunded with zero deduction.',
    });
  }

  // Compute aggregated totals
  const totalDeductions = legs.reduce((acc, leg) => acc + leg.deductionAmount, 0);
  const estimatedRefund = legs.reduce((acc, leg) => acc + leg.refundableAmount, 0);
  const cancellableLegsCount = legs.filter((l) => l.isCancelable).length;
  const nonCancellableLegsCount = legs.filter((l) => !l.isCancelable).length;
  const refundPercentage = totalAmount > 0 ? Math.round((estimatedRefund / totalAmount) * 100) : 0;

  const canExecute = !isAlreadyCancelled && !isDelivered && cancellableLegsCount > 0;

  const policyNotes = [
    'Cancellations made before train seal cutoff receive the maximum eligible refund (~90%).',
    'Active line-haul rail legs incur a container slot salvage fee; released capacity is routed to the Return Exchange Agent.',
    'Uncommenced last-mile and feeder legs receive a 100% full refund with zero penalty.',
    'Completed or delivered legs are strictly non-refundable.',
    'Refunds are processed automatically via Lonics Temporal Saga rollbacks to the source SME account within 2–4 hours.',
  ];

  return {
    bookingId,
    origin,
    destination,
    totalBookingAmount: totalAmount,
    totalDeductions,
    estimatedRefund,
    refundPercentage,
    legs,
    cancellableLegsCount,
    nonCancellableLegsCount,
    canExecuteCancellation: canExecute,
    policyNotes,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Format currency amount in Indian Rupee format.
 */
export function formatINR(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN');
}
