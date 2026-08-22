import { useState, useEffect, useCallback } from 'react';
import type { RailDeparture, RailReservation, ReservationStatus, DepartureStatus } from '../types/rail-booking';
import { MOCK_FREIGHT_SCHEDULES, INITIAL_SEED_RESERVATIONS } from '../data/railSchedulesData';

const STORAGE_DEPARTURES_KEY = 'lonics_session_rail_departures_v1';
const STORAGE_RESERVATIONS_KEY = 'lonics_session_rail_reservations_v1';

export function useRailBookingSession() {
  const [departures, setDepartures] = useState<RailDeparture[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_DEPARTURES_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return MOCK_FREIGHT_SCHEDULES;
  });

  const [reservations, setReservations] = useState<RailReservation[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_RESERVATIONS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_SEED_RESERVATIONS;
  });

  // Persist changes to session storage
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_DEPARTURES_KEY, JSON.stringify(departures));
    } catch {
      // ignore
    }
  }, [departures]);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_RESERVATIONS_KEY, JSON.stringify(reservations));
    } catch {
      // ignore
    }
  }, [reservations]);

  // Book an available container slot
  const bookSlot = useCallback(
    (departureId: string, cargoDescription = 'Consolidated General Cargo', consigneeName = 'Self-Consignee / Verified Shipper'): RailReservation | null => {
      const targetDep = departures.find((d) => d.id === departureId);
      if (!targetDep || targetDep.remainingSlots <= 0) return null;

      const newRemaining = targetDep.remainingSlots - 1;
      let newStatus: DepartureStatus = 'AVAILABLE';
      let newLabel = `AVAILABLE ${newRemaining}`;

      if (newRemaining === 0) {
        newStatus = 'WAITLIST';
        newLabel = 'WL01';
      } else if (newRemaining === 1) {
        newStatus = 'LAST_SLOT';
        newLabel = 'LAST SLOT';
      } else if (newRemaining <= 4) {
        newStatus = 'LOW_AVAILABILITY';
        newLabel = `AVAILABLE ${newRemaining}`;
      }

      const updatedDeparture: RailDeparture = {
        ...targetDep,
        remainingSlots: newRemaining,
        status: newStatus,
        statusLabel: newLabel,
        waitlistCount: newRemaining === 0 ? 1 : targetDep.waitlistCount,
      };

      const randSuffix = Math.floor(10 + Math.random() * 90);
      const cleanCode = targetDep.containerCode.replace(/[^A-Za-z0-9]/g, '');
      const newReservation: RailReservation = {
        id: `res-${Date.now()}-${randSuffix}`,
        bookingReference: `RES-${cleanCode}-${randSuffix}`,
        departureId: targetDep.id,
        departure: updatedDeparture,
        status: 'CONFIRMED',
        slotNumber: targetDep.totalCapacitySlots - newRemaining,
        bookedAt: new Date().toISOString(),
        cargoDescription,
        consigneeName,
        pricingSnapshot: updatedDeparture.pricing,
      };

      setDepartures((prev) => prev.map((d) => (d.id === departureId ? updatedDeparture : d)));
      setReservations((prev) => [newReservation, ...prev]);

      return newReservation;
    },
    [departures]
  );

  // Join waitlist for full container
  const joinWaitlist = useCallback(
    (departureId: string, cargoDescription = 'Consolidated General Cargo', consigneeName = 'Self-Consignee / Verified Shipper'): RailReservation | null => {
      const targetDep = departures.find((d) => d.id === departureId);
      if (!targetDep) return null;

      const newWlCount = targetDep.waitlistCount + 1;
      const wlStatusStr = (`WL0${Math.min(9, newWlCount)}`) as ReservationStatus;

      const updatedDeparture: RailDeparture = {
        ...targetDep,
        status: 'WAITLIST',
        waitlistCount: newWlCount,
        statusLabel: `WL0${Math.min(9, newWlCount)}`,
      };

      const randSuffix = Math.floor(10 + Math.random() * 90);
      const cleanCode = targetDep.containerCode.replace(/[^A-Za-z0-9]/g, '');
      const newReservation: RailReservation = {
        id: `wl-${Date.now()}-${randSuffix}`,
        bookingReference: `WL-${cleanCode}-0${newWlCount}`,
        departureId: targetDep.id,
        departure: updatedDeparture,
        status: wlStatusStr,
        waitlistPosition: newWlCount,
        bookedAt: new Date().toISOString(),
        cargoDescription,
        consigneeName,
        pricingSnapshot: updatedDeparture.pricing,
      };

      setDepartures((prev) => prev.map((d) => (d.id === departureId ? updatedDeparture : d)));
      setReservations((prev) => [newReservation, ...prev]);

      return newReservation;
    },
    [departures]
  );

  // Cancel reservation or waitlist ticket
  const cancelReservation = useCallback((reservationId: string): boolean => {
    let affectedDepartureId: string | null = null;
    let wasConfirmed = false;
    let wasWaitlist = false;

    setReservations((prev) =>
      prev.map((res) => {
        if (res.id === reservationId && res.status !== 'CANCELLED') {
          affectedDepartureId = res.departureId;
          wasConfirmed = res.status === 'CONFIRMED';
          wasWaitlist = res.status.startsWith('WL');
          return {
            ...res,
            status: 'CANCELLED',
            cancelledAt: new Date().toISOString(),
          };
        }
        return res;
      })
    );

    if (affectedDepartureId) {
      setDepartures((prev) =>
        prev.map((dep) => {
          if (dep.id === affectedDepartureId) {
            if (wasConfirmed) {
              const newRemaining = Math.min(dep.totalCapacitySlots, dep.remainingSlots + 1);
              let newStatus: DepartureStatus = 'AVAILABLE';
              let newLabel = `AVAILABLE ${newRemaining}`;

              if (newRemaining === 1) {
                newStatus = 'LAST_SLOT';
                newLabel = 'LAST SLOT';
              } else if (newRemaining <= 4) {
                newStatus = 'LOW_AVAILABILITY';
                newLabel = `AVAILABLE ${newRemaining}`;
              }

              return {
                ...dep,
                remainingSlots: newRemaining,
                status: newStatus,
                statusLabel: newLabel,
              };
            } else if (wasWaitlist) {
              const newWlCount = Math.max(0, dep.waitlistCount - 1);
              return {
                ...dep,
                waitlistCount: newWlCount,
                statusLabel: newWlCount > 0 ? `WL0${Math.min(9, newWlCount)}` : dep.statusLabel,
              };
            }
          }
          return dep;
        })
      );
      return true;
    }

    return false;
  }, []);

  return {
    departures,
    reservations,
    bookSlot,
    joinWaitlist,
    cancelReservation,
  };
}
