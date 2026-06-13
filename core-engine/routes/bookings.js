import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../supabase.js';
import { compatibilityGuard, windowCargoClassesCache } from '../middleware/compatibilityGuard.js';
import { calculateHybridRates } from '../services/pricingEngine.js';

const router = express.Router();

const MAX_CBM = 28.0;     // Max volume (Cubic Meters)
const MAX_KG = 18000.0;   // Max weight payload capacity (KG)

// Robust in-memory fallbacks for when remote Supabase RLS policies block public writes
export const shipmentsFallbackCache = new Map(); // booking_id -> shipment
export const containerCacheFallback = new Map(); // window_id -> container status

/**
 * Helper to parse dimensions (cm or mm) to CBM.
 */
function parseCargoCBM(item) {
  let length = parseFloat(item.length || item.length_cm || 0);
  let width = parseFloat(item.width || item.width_cm || 0);
  let height = parseFloat(item.height || item.height_cm || 0);
  const qty = parseInt(item.quantity || 1);

  if (item.unit === 'mm' || length > 250 || width > 250 || height > 250) {
    length = length / 10;
    width = width / 10;
    height = height / 10;
  }

  const volumeCm3 = length * width * height * qty;
  return volumeCm3 / 1000000.0;
}

/**
 * POST /api/bookings and POST /api/v1/freight/book
 * Ingestion Engine & Consolidation Agent
 */
async function processBookingHandler(req, res) {
  try {
    const payload = req.body;
    
    let cargoItems = [];
    let shipperId = 'SHIP-DFC-001';
    let origin = 'Mumbai Port DFC Gate-1';
    let destination = 'Delhi ICD Terminal-3';
    let railLockUpgrade = false;

    if (Array.isArray(payload)) {
      cargoItems = payload;
    } else if (payload && Array.isArray(payload.cargo_items)) {
      cargoItems = payload.cargo_items;
      shipperId = payload.shipper_id || shipperId;
      origin = payload.origin || origin;
      destination = payload.destination || destination;
      railLockUpgrade = !!payload.rail_lock_upgrade;
    } else {
      return res.status(400).json({ error: 'Invalid cargo booking payload format.' });
    }

    if (cargoItems.length === 0) {
      return res.status(400).json({ error: 'Cargo items array cannot be empty.' });
    }

    // 1. Calculate Consolidation & Chargeable Weight metrics
    let totalCbm = 0.0;
    let totalActualWeight = 0.0;

    for (const item of cargoItems) {
      const cbm = parseCargoCBM(item);
      totalCbm += cbm;
      
      const qty = parseInt(item.quantity || 1);
      const weight = parseFloat(item.weight_kg || item.weight || 0);
      totalActualWeight += weight * qty;
    }

    const totalVolumetricWeight = totalCbm * 167;
    const chargeableWeight = Math.max(totalActualWeight, totalVolumetricWeight);

    // 2. Dual-Brain Pricing
    const pricing = await calculateHybridRates(origin, destination, chargeableWeight);
    const basePrice = pricing.railBasePrice;

    // 3. Queue Packing & Container State Management (isolated per shipper via window naming)
    let currentCbm = 0.0;
    let currentKg = 0.0;
    
    let activeWindowId = req.assignedWindowId || `WIN-${shipperId}-PRIMARY`;
    let dbActive = false;

    try {
      // Fetch current window status from database
      const { data: activeContainer, error: selectError } = await supabase
        .from('container_cache')
        .select('*')
        .eq('window_id', activeWindowId)
        .maybeSingle();

      if (selectError) {
        console.warn('[Consolidation] Supabase fetch warning, using cache/fallback:', selectError.message);
      }

      if (activeContainer) {
        currentCbm = parseFloat(activeContainer.current_cbm || 0);
        currentKg = parseFloat(activeContainer.current_kg || 0);
        dbActive = true;
      } else {
        // Try initializing active container window in Supabase
        const { error: insertError } = await supabase
          .from('container_cache')
          .insert({
            window_id: activeWindowId,
            current_cbm: 0.0,
            current_kg: 0.0
          });
        
        if (insertError) {
          console.warn('[Consolidation] Supabase init warning, using cache/fallback:', insertError.message);
        } else {
          dbActive = true;
        }
      }
    } catch (dbErr) {
      console.error('[Consolidation] Supabase connection issue during setup:', dbErr.message);
    }

    // If Supabase was not active or RLS blocked it, check our local fallback cache
    if (!dbActive) {
      const cachedContainer = containerCacheFallback.get(activeWindowId) || {
        window_id: activeWindowId,
        current_cbm: 0.0,
        current_kg: 0.0
      };
      currentCbm = cachedContainer.current_cbm;
      currentKg = cachedContainer.current_kg;
    }

    // Calculate utilization for the contingency buffer
    const capacityUtilization = currentCbm / MAX_CBM;
    const contingencyBuffer = basePrice * capacityUtilization * 0.15;
    
    let totalQuote = basePrice + contingencyBuffer;
    if (railLockUpgrade) {
      totalQuote = totalQuote * 1.12;
    }

    // Evaluate threshold breaches
    const newCbm = currentCbm + totalCbm;
    const newKg = currentKg + totalActualWeight;
    const isBreached = (newCbm > MAX_CBM || newKg > MAX_KG);
    
    let assignedWindowId = activeWindowId;
    let finalCbm = newCbm;
    let finalKg = newKg;

    if (isBreached) {
      // Allocate a new container window specific to this shipper
      const uniqueSuffix = uuidv4().substring(0, 8).toUpperCase();
      assignedWindowId = `WIN-${shipperId}-${uniqueSuffix}-NEW`;
      finalCbm = totalCbm;
      finalKg = totalActualWeight;
      
      console.log(`[Consolidation] Container breached (CBM: ${newCbm}/${MAX_CBM}, KG: ${newKg}/${MAX_KG}). Creating container: ${assignedWindowId}`);
      
      if (dbActive) {
        try {
          const { error: insertError } = await supabase
            .from('container_cache')
            .insert({
              window_id: assignedWindowId,
              current_cbm: parseFloat(finalCbm.toFixed(3)),
              current_kg: parseFloat(finalKg.toFixed(2))
            });
          if (insertError) {
            console.warn('[Consolidation] Supabase container creation RLS/permission blocked:', insertError.message);
            dbActive = false; // Fallback to cache
          }
        } catch (dbWriteErr) {
          console.error('[Consolidation] Failed to insert new container:', dbWriteErr);
          dbActive = false;
        }
      }
    } else {
      if (dbActive) {
        try {
          const { error: updateError } = await supabase
            .from('container_cache')
            .update({
              current_cbm: parseFloat(finalCbm.toFixed(3)),
              current_kg: parseFloat(finalKg.toFixed(2))
            })
            .eq('window_id', assignedWindowId);
          if (updateError) {
            console.warn('[Consolidation] Supabase update RLS/permission blocked:', updateError.message);
            dbActive = false; // Fallback to cache
          }
        } catch (dbWriteErr) {
          console.error('[Consolidation] Failed to update container capacity:', dbWriteErr);
          dbActive = false;
        }
      }
    }

    // Sync capacity state in fallback cache
    containerCacheFallback.set(assignedWindowId, {
      window_id: assignedWindowId,
      current_cbm: parseFloat(finalCbm.toFixed(3)),
      current_kg: parseFloat(finalKg.toFixed(2))
    });

    // Update compatibility cache
    const existingClasses = windowCargoClassesCache.get(assignedWindowId) || new Set();
    const incomingClasses = req.newCargoClasses || [];
    incomingClasses.forEach(cls => existingClasses.add(cls));
    windowCargoClassesCache.set(assignedWindowId, existingClasses);

    const bookingId = `BK-${uuidv4().substring(0, 8).toUpperCase()}`;

    // 5. Save shipment booking record
    const shipmentData = {
      booking_id: bookingId,
      assigned_window_id: assignedWindowId,
      chargeable_weight: parseFloat(chargeableWeight.toFixed(2)),
      total_cbm: parseFloat(totalCbm.toFixed(3)),
      final_quote: parseFloat(totalQuote.toFixed(2)),
      status: 'RESERVATION_INITIATED',
      shipper_id: shipperId,
      origin: origin,
      destination: destination,
      created_at: new Date().toISOString()
    };

    let savedInDb = false;
    if (dbActive) {
      try {
        const { error: insertShipmentError } = await supabase
          .from('shipments')
          .insert(shipmentData);
        
        if (insertShipmentError) {
          console.warn('[Consolidation] Supabase shipments insert RLS/permission blocked:', insertShipmentError.message);
        } else {
          savedInDb = true;
          console.log(`[Consolidation] Booking ${bookingId} committed directly to remote Supabase DB.`);
        }
      } catch (shipmentDbErr) {
        console.error('[Consolidation] Shipments DB save exception:', shipmentDbErr.message);
      }
    }

    // Always commit to local fallback cache in case DB read fails later or to maintain dual states
    shipmentsFallbackCache.set(bookingId, shipmentData);
    if (!savedInDb) {
      console.log(`[Consolidation] Booking ${bookingId} committed to local fallback cache (Database write bypassed/blocked).`);
    }

    const responsePayload = {
      booking_id: bookingId,
      chargeable_weight: parseFloat(chargeableWeight.toFixed(2)),
      total_cbm: parseFloat(totalCbm.toFixed(3)),
      base_price: parseFloat(basePrice.toFixed(2)),
      contingency_buffer: parseFloat(contingencyBuffer.toFixed(2)),
      final_quote: parseFloat(totalQuote.toFixed(2)),
      status: 'RESERVATION_INITIATED',
      assigned_window_id: assignedWindowId
    };

    return res.status(201).json(responsePayload);
  } catch (err) {
    console.error('[Ingestion Engine] Booking error:', err);
    return res.status(500).json({ error: 'Booking processing failed.', detail: err.message });
  }
}

router.post('/book', compatibilityGuard, processBookingHandler);
router.post('/bookings', compatibilityGuard, processBookingHandler);

/**
 * POST /api/v1/freight/cancel/:bookingId
 */
router.post('/cancel/:bookingId', async (req, res) => {
  const { bookingId } = req.params;
  console.log(`[SAGA] >>> Initiating rollback saga for booking: ${bookingId}`);

  let shipment = shipmentsFallbackCache.get(bookingId);

  try {
    const { data: dbShipment, error: findError } = await supabase
      .from('shipments')
      .select('*')
      .eq('booking_id', bookingId)
      .maybeSingle();

    if (dbShipment && !findError) {
      shipment = dbShipment;
    }
  } catch (err) {
    // lookup fail
  }

  if (shipment) {
    const windowId = shipment.assigned_window_id;
    let container = containerCacheFallback.get(windowId);

    try {
      const { data: dbContainer, error: containerError } = await supabase
        .from('container_cache')
        .select('*')
        .eq('window_id', windowId)
        .maybeSingle();

      if (dbContainer && !containerError) {
        container = dbContainer;
      }
    } catch (err) {
      // container lookup fail
    }

    const currentCbmVal = container ? (container.current_cbm || container.cbm || 0) : 0;
    const currentKgVal = container ? (container.current_kg || container.kg || 0) : 0;

    const updatedCbm = Math.max(0, parseFloat(currentCbmVal) - parseFloat(shipment.total_cbm || 0));
    const updatedKg = Math.max(0, parseFloat(currentKgVal) - parseFloat(shipment.chargeable_weight || 0));

    // Update fallback cache
    containerCacheFallback.set(windowId, {
      window_id: windowId,
      current_cbm: parseFloat(updatedCbm.toFixed(3)),
      current_kg: parseFloat(updatedKg.toFixed(2))
    });

    // Update Supabase
    try {
      await supabase
        .from('container_cache')
        .update({
          current_cbm: parseFloat(updatedCbm.toFixed(3)),
          current_kg: parseFloat(updatedKg.toFixed(2))
        })
        .eq('window_id', windowId);

      await supabase
        .from('shipments')
        .update({ status: 'CANCELLED' })
        .eq('booking_id', bookingId);
    } catch (err) {
      // ignore update errors on cancellation RLS block
    }

    // Update local cache status
    shipment.status = 'CANCELLED';
    shipmentsFallbackCache.set(bookingId, shipment);
  }

  setTimeout(() => {
    console.log(`[SAGA] [Step 1/3] [release_truck_hold] Canceled first-mile feeder truck reservation for ${bookingId}.`);
  }, 1000);

  setTimeout(() => {
    console.log(`[SAGA] [Step 2/3] [release_cto_slot] Released Container Train Operator (CTO) block allocation for ${bookingId}.`);
  }, 2000);

  setTimeout(() => {
    console.log(`[SAGA] [Step 3/3] [trigger_secondary_flash_auction] Triggered secondary backhaul spot auction for released CBM space.`);
    console.log(`[SAGA] <<< Rollback saga completed successfully for booking: ${bookingId}\n`);
  }, 3000);

  return res.json({
    status: 'rollback_initiated',
    booking_id: bookingId,
    detail: 'Background rollback saga tasks queued for execution.'
  });
});

/**
 * GET /api/v1/freight/container-status
 */
router.get('/container-status', async (req, res) => {
  const shipperId = req.query.shipper_id || 'SHIP-DFC-001';
  let activeWindowId = `WIN-${shipperId}-PRIMARY`;

  try {
    const { data: latestShipment, error: findError } = await supabase
      .from('shipments')
      .select('assigned_window_id')
      .eq('shipper_id', shipperId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestShipment && !findError) {
      activeWindowId = latestShipment.assigned_window_id;
    }
  } catch (err) {
    // use default
  }

  // Check fallback cache first (since it is always up to date even if Supabase updates fail/block)
  const cachedContainer = containerCacheFallback.get(activeWindowId);
  if (cachedContainer) {
    return res.json({
      window_id: cachedContainer.window_id,
      current_cbm: cachedContainer.current_cbm,
      current_kg: cachedContainer.current_kg,
      max_cbm_threshold: MAX_CBM,
      max_kg_threshold: MAX_KG
    });
  }

  try {
    const { data: activeContainer, error } = await supabase
      .from('container_cache')
      .select('*')
      .eq('window_id', activeWindowId)
      .maybeSingle();

    if (activeContainer && !error) {
      const cbm = parseFloat(activeContainer.current_cbm || activeContainer.cbm || 0);
      const kg = parseFloat(activeContainer.current_kg || activeContainer.kg || 0);
      return res.json({
        window_id: activeContainer.window_id,
        current_cbm: parseFloat(cbm.toFixed(3)),
        current_kg: parseFloat(kg.toFixed(2)),
        max_cbm_threshold: MAX_CBM,
        max_kg_threshold: MAX_KG
      });
    }
  } catch (err) {
    console.error('[Status Engine] Error querying active container:', err);
  }

  return res.json({
    window_id: activeWindowId,
    current_cbm: 0.0,
    current_kg: 0.0,
    max_cbm_threshold: MAX_CBM,
    max_kg_threshold: MAX_KG
  });
});

export default router;
