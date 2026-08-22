/**
 * Lonics Operational Events Service
 *
 * Publishes and subscribes to operational events through the Supabase Realtime layer.
 * Uses the existing `supabase` client from lib/supabase.ts — no new dependencies.
 *
 * Architecture:
 * - publishOperationalEvent(): writes to Supabase `operator_events` table (with graceful fallback)
 * - subscribeToShipmentEvents(): subscribes via Supabase Realtime channel
 *
 * GPS sessionStorage is used ONLY as a local cache by LiveRoutePanel.
 * The authoritative GPS state flows through the Supabase Realtime channel.
 */

import { supabase } from '../lib/supabase';
import type { OperationalEvent } from '../types/operator';

// ──────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────

const CHANNEL_PREFIX = 'lonics:ops:';
const TABLE_NAME = 'operator_events';

// ──────────────────────────────────────────────────────────
// Publish
// ──────────────────────────────────────────────────────────

/**
 * Publish an operational event to the Supabase backend.
 *
 * Flow:
 * 1. INSERT into `operator_events` table (primary persistence).
 * 2. Broadcast on Supabase Realtime channel `lonics:ops:{shipmentId}`.
 * 3. If table insert fails (table may not exist in dev), falls back to Realtime broadcast only.
 *
 * @throws Never — errors are caught and logged, never propagated to UI.
 */
export async function publishOperationalEvent(event: OperationalEvent): Promise<void> {
  const payload = {
    event_type: event.eventType,
    shipment_id: event.shipmentId,
    seal_id: event.sealId ?? null,
    operator_id: event.operatorId,
    location: event.location,
    timestamp: event.timestamp,
    metadata: event.metadata ?? null,
  };

  // 1. Try DB insert
  try {
    const { error } = await supabase.from(TABLE_NAME).insert(payload);
    if (error) {
      console.warn(`[OperationalEvents] DB insert notice (${TABLE_NAME}):`, error.message);
    } else {
      console.log(`[OperationalEvents] ✓ Event persisted: ${event.eventType} for ${event.shipmentId}`);
    }
  } catch (dbErr) {
    console.warn('[OperationalEvents] DB insert skipped (table may not exist in dev):', dbErr);
  }

  // 2. Realtime broadcast (always attempted — works without DB table)
  try {
    const channel = supabase.channel(`${CHANNEL_PREFIX}${event.shipmentId}`);
    await channel.send({
      type: 'broadcast',
      event: event.eventType,
      payload: event,
    });
    channel.unsubscribe();
  } catch (rtErr) {
    console.warn('[OperationalEvents] Realtime broadcast warning:', rtErr);
  }
}

// ──────────────────────────────────────────────────────────
// Subscribe
// ──────────────────────────────────────────────────────────

/**
 * Subscribe to operational events for a specific shipment.
 * Used by Mission Control and Ground Ops to observe events in real-time.
 *
 * @param shipmentId - The shipment to subscribe to.
 * @param cb - Callback fired with each incoming event.
 * @returns An unsubscribe function — call it on component unmount.
 *
 * @example
 *   const unsub = subscribeToShipmentEvents('LC-2847', (e) => console.log(e));
 *   // On unmount:
 *   unsub();
 */
export function subscribeToShipmentEvents(
  shipmentId: string,
  cb: (event: OperationalEvent) => void
): () => void {
  const channelName = `${CHANNEL_PREFIX}${shipmentId}`;

  const channel = supabase
    .channel(channelName)
    .on('broadcast', { event: '*' }, ({ payload }) => {
      if (payload && payload.eventType && payload.shipmentId === shipmentId) {
        cb(payload as OperationalEvent);
      }
    })
    .subscribe((status) => {
      console.log(`[OperationalEvents] Channel ${channelName}: ${status}`);
    });

  return () => {
    channel.unsubscribe();
  };
}

// ──────────────────────────────────────────────────────────
// GPS Publish (Authoritative)
// ──────────────────────────────────────────────────────────

/**
 * Publish a GPS update via Supabase Realtime.
 *
 * This is the AUTHORITATIVE GPS path:
 *   1. Realtime broadcast on `lonics:gps` (subscribed to by Mission Control)
 *   2. Upsert to `operator_gps_updates` table (with graceful fallback)
 *   3. sessionStorage write is done separately in LiveRoutePanel as a local cache ONLY
 *
 * @param update - The GPS update payload from navigator.geolocation.watchPosition
 */
export async function publishGPSUpdate(update: {
  driverId: string;
  shipmentId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed?: number;
  heading?: number;
  timestamp: string;
}): Promise<void> {
  // 1. Realtime broadcast
  try {
    const channel = supabase.channel('lonics:gps');
    await channel.send({
      type: 'broadcast',
      event: 'GPS_UPDATE',
      payload: update,
    });
    channel.unsubscribe();
  } catch (rtErr) {
    console.warn('[GPS] Realtime broadcast warning:', rtErr);
  }

  // 2. DB upsert
  try {
    const { error } = await supabase.from('operator_gps_updates').upsert({
      driver_id: update.driverId,
      shipment_id: update.shipmentId,
      latitude: update.latitude,
      longitude: update.longitude,
      accuracy: update.accuracy,
      speed: update.speed ?? null,
      heading: update.heading ?? null,
      timestamp: update.timestamp,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.warn('[GPS] DB upsert notice (table may not exist in dev):', error.message);
    }
  } catch (dbErr) {
    console.warn('[GPS] DB upsert skipped:', dbErr);
  }
}
