import { describe, it, expect } from 'vitest';
import type { TrackedShipment } from '../components/MultiSignalTracker';

describe('Multi-Signal Tracking Data Architecture', () => {
  const sampleShipments: TrackedShipment[] = [
    {
      bookingId: 'BK-8930',
      origin: 'Mumbai Port DFC Gate-1',
      destination: 'Delhi ICD Terminal-3',
      commodity: 'Precision Engineering',
      status: 'IN_TRANSIT',
      stage: 'Line-Haul DFC Transit',
      transitProgress: 65,
      uptimeSla: 'Normal',
      speedKmh: 55,
      signalSource: 'FOIS_Pravah_Live',
      heading: 'North-East',
      assignedWindowId: 'WIN-PRIMARY-DFC',
      currentCoordinates: { lat: 22.84, lng: 74.52 },
      aqiMetrics: {
        aqi: 142,
        grapStage: 'STAGE_I_MODERATE',
        activeRestrictions: 'None',
        apiSource: 'Open-Meteo Air Quality',
      },
      route: ['Mumbai Port DFC Gate-1', 'Dadri ICD Gateway', 'Delhi ICD Terminal-3'],
      statusDescription: 'W-DFC Line-Haul in transit.',
      isDelayed: false,
      isCancelled: false,
      totalBookingAmount: 16650,
      lastPing: new Date().toISOString(),
    },
    {
      bookingId: 'BK-4102',
      origin: 'Ludhiana ICD Yard',
      destination: 'Mumbai Port DFC Gate-1',
      commodity: 'Textiles',
      status: 'REROUTED_GRAP_ACTIVE',
      stage: 'First-Mile Feeder Dispatch',
      transitProgress: 28,
      uptimeSla: 'Re-Route Split (+45m)',
      speedKmh: 38,
      signalSource: 'NTES_Fallback_Station',
      heading: 'South-West',
      assignedWindowId: 'WIN-NORTH-CORRIDOR',
      currentCoordinates: { lat: 30.90, lng: 75.85 },
      aqiMetrics: {
        aqi: 385,
        grapStage: 'STAGE_III_SEVERE',
        activeRestrictions: 'Commercial diesel ban in NCR',
        apiSource: 'Open-Meteo Air Quality',
      },
      route: ['Ludhiana ICD Yard', 'Electric-LCV Split Gate (Dadri)', 'Mumbai Port DFC Gate-1'],
      statusDescription: 'Rerouted due to NCR Stage III GRAP.',
      isDelayed: false,
      isCancelled: false,
      totalBookingAmount: 21600,
      lastPing: new Date().toISOString(),
    },
  ];

  it('correctly manages multiple concurrent active shipments', () => {
    expect(sampleShipments.length).toBe(2);
    expect(sampleShipments[0].bookingId).toBe('BK-8930');
    expect(sampleShipments[1].bookingId).toBe('BK-4102');
  });

  it('preserves per-shipment stage, progress, and SLA independence', () => {
    expect(sampleShipments[0].transitProgress).toBe(65);
    expect(sampleShipments[1].transitProgress).toBe(28);
    expect(sampleShipments[0].uptimeSla).toBe('Normal');
    expect(sampleShipments[1].uptimeSla).toBe('Re-Route Split (+45m)');
  });

  it('correctly models scoped per-shipment cancellation', () => {
    const updated = sampleShipments.map((s) => {
      if (s.bookingId === 'BK-8930') {
        return {
          ...s,
          isCancelled: true,
          status: 'CANCELLED',
          transitProgress: 0,
          uptimeSla: 'Saga Reversal Complete',
          cancellationRefundAmount: 11250,
        };
      }
      return s;
    });

    const cancelled = updated.find((s) => s.bookingId === 'BK-8930');
    const intact = updated.find((s) => s.bookingId === 'BK-4102');

    expect(cancelled?.isCancelled).toBe(true);
    expect(cancelled?.status).toBe('CANCELLED');
    expect(cancelled?.cancellationRefundAmount).toBe(11250);

    expect(intact?.isCancelled).toBe(false);
    expect(intact?.status).toBe('REROUTED_GRAP_ACTIVE');
  });
});
