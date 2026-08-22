import type { RailPricingResult } from '../utils/railPricingEngine';

export type DepartureStatus = 'AVAILABLE' | 'LOW_AVAILABILITY' | 'LAST_SLOT' | 'WAITLIST';

export type ReservationStatus =
  | 'CONFIRMED'
  | 'WL01'
  | 'WL02'
  | 'WL03'
  | 'WL04'
  | 'WL05'
  | 'CANCELLED';

export interface RailDeparture {
  id: string;
  date: string;
  time: string;
  origin: string;
  originTerminal: string;
  destination: string;
  destinationTerminal: string;
  containerCode: string;
  containerType: string;
  totalCapacitySlots: number;
  remainingSlots: number;
  status: DepartureStatus;
  waitlistCount: number; // Active queue count
  statusLabel: string;
  rakeNumber: string;
  cutoffTime: string;
  operator: string;
  chargeableDistanceKm: number;
  cargoWeightTonnes: number;
  pricing: RailPricingResult;
}

export interface RailReservation {
  id: string;
  bookingReference: string; // e.g. "RES-LC2847-01" or "WL-LC4421-02"
  departureId: string;
  departure: RailDeparture;
  status: ReservationStatus;
  slotNumber?: number;
  waitlistPosition?: number;
  bookedAt: string;
  cargoDescription: string;
  consigneeName: string;
  cancelledAt?: string;
  // Immutable pricing snapshot captured at booking time
  pricingSnapshot: RailPricingResult;
}

export type ModalTab = 'departures' | 'reservations';

