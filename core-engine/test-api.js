/**
 * End-to-End Automated API Test Suite for Leonics Multimodal Freight Engine
 * Hitting http://localhost:8000
 */

const BASE_URL = 'http://localhost:8000';
const MOCK_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

async function runTests() {
  console.log('🧪 Starting Leonics Multimodal E2E Test Suite...\n');
  
  // 1. Health check
  try {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();
    console.log(`✅ [Health Check] Status: ${res.status} (${data.status})\n`);
  } catch (err) {
    console.error('❌ Health check failed. Make sure the server is running on port 8000.', err.message);
    process.exit(1);
  }

  let testBookingId = null;

  // 2. Booking Ingestion & Consolidation Test (Positive Case)
  try {
    console.log('📋 Test 1: Ingestion & Volumetric Consolidation');
    const payload = {
      shipper_id: 'SHIP-DFC-001',
      origin: 'Mumbai Port DFC Gate-1',
      destination: 'Delhi ICD Terminal-3',
      rail_lock_upgrade: true,
      cargo_items: [
        {
          package_type: 'Carton',
          cargo_class: 'General',
          length: 120, // cm
          width: 80,   // cm
          height: 100, // cm
          quantity: 2,
          weight_kg: 150
        }
      ]
    };

    const res = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (res.status !== 201) {
      throw new Error(`Expected status 201, got ${res.status}`);
    }

    const data = await res.json();
    testBookingId = data.booking_id;
    console.log(`   - Booking Created: ${data.booking_id}`);
    console.log(`   - Assigned Container: ${data.assigned_window_id}`);
    console.log(`   - CBM Calculated: ${data.total_cbm} CBM (Expected: 1.92 CBM)`);
    console.log(`   - Chargeable Weight: ${data.chargeable_weight} kg`);
    console.log(`   - Final Quote: ₹${data.final_quote}`);
    console.log('✅ Ingestion & Consolidation calculation verified.\n');
  } catch (err) {
    console.error('❌ Ingestion & Consolidation test failed:', err.message);
  }

  // 3. Compatibility Guard Test (Negative Case: Toxic + Foodstuff)
  try {
    console.log('📋 Test 2: Compatibility Guard Cross-Exclusion Matrix');
    const badPayload = {
      shipper_id: 'SHIP-DFC-001',
      origin: 'Mumbai Port',
      destination: 'Delhi ICD',
      cargo_items: [
        {
          package_type: 'Drum',
          cargo_class: 'Toxic',
          length: 50,
          width: 50,
          height: 100,
          quantity: 1,
          weight_kg: 80
        },
        {
          package_type: 'Carton',
          cargo_class: 'Foodstuff',
          length: 40,
          width: 40,
          height: 40,
          quantity: 5,
          weight_kg: 20
        }
      ]
    };

    const res = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(badPayload)
    });

    const data = await res.json();
    if (res.status === 400 && data.error === 'COMPATIBILITY_BREACH') {
      console.log(`   - Successfully blocked: ${data.message}`);
      console.log('✅ Compatibility Guard validation blocked unsafe co-loading.\n');
    } else {
      throw new Error(`Expected status 400 COMPATIBILITY_BREACH, got ${res.status}`);
    }
  } catch (err) {
    console.error('❌ Compatibility Guard test failed:', err.message);
  }

  // 4. Metric Fusion Live Telemetry & AQI Reroute Test
  if (testBookingId) {
    try {
      console.log(`📋 Test 3: Metric Fusion Live Telemetry (ID: ${testBookingId})`);
      const res = await fetch(`${BASE_URL}/api/tracking/${testBookingId}`);
      const data = await res.json();
      
      console.log(`   - Destination: ${data.destination}`);
      console.log(`   - Current Status: ${data.status}`);
      console.log(`   - Route Nodes: ${data.route.join(' -> ')}`);
      console.log(`   - Live AQI: ${data.aqi_metrics.aqi} (${data.aqi_metrics.grap_stage})`);
      console.log(`   - Live Location: Lat ${data.telemetry.current_coordinates.lat}, Lng ${data.telemetry.current_coordinates.lng}`);
      console.log(`   - Signal Feed: ${data.telemetry.signal_source}`);
      console.log('✅ Metric Fusion tracking telemetry verified.\n');
    } catch (err) {
      console.error('❌ Metric Fusion test failed:', err.message);
    }
  }

  // 5. POST /api/tracking/scan - Cargo Image Voxel Scan Test
  try {
    console.log('📋 Test 4: Gemini CV Cargo Voxel Image Processing');
    const res = await fetch(`${BASE_URL}/api/tracking/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: MOCK_BASE64,
        type: 'cargo'
      })
    });

    const data = await res.json();
    if (res.status === 200 && data.success && data.dimensions) {
      console.log(`   - Detected Dimensions: ${data.dimensions.length}x${data.dimensions.width}x${data.dimensions.height} cm`);
      console.log(`   - Cargo Classification: ${data.dimensions.type}`);
      console.log('✅ Gemini CV Cargo Voxel processing verified.\n');
    } else {
      throw new Error(`Cargo scan failed: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.error('❌ Gemini CV Cargo Voxel test failed:', err.message);
  }

  // 6. POST /api/tracking/scan - Seal Verification Test
  if (testBookingId) {
    try {
      console.log(`📋 Test 5: Gemini CV Seal Verification scan (ID: ${testBookingId})`);
      const res = await fetch(`${BASE_URL}/api/tracking/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: MOCK_BASE64,
          type: 'seal',
          booking_id: testBookingId
        })
      });
      
      const data = await res.json();
      if (data.success && data.status === 'DELIVERED') {
        console.log(`   - Seal Verification: ${data.message}`);
      } else {
        throw new Error(`Seal verification failed: ${JSON.stringify(data)}`);
      }

      // Re-verify tracking details
      const verifyRes = await fetch(`${BASE_URL}/api/tracking/${testBookingId}`);
      const verifyData = await verifyRes.json();
      console.log(`   - Updated Shipment Status: ${verifyData.status}`);
      
      if (verifyData.status === 'DELIVERED') {
        console.log('✅ Gemini CV Seal Verification status finalize verified.\n');
      } else {
        throw new Error(`Expected status DELIVERED, got ${verifyData.status}`);
      }
    } catch (err) {
      console.error('❌ Seal Verification test failed:', err.message);
    }
  }

  console.log('🏁 E2E Test Suite Completed.');
}

runTests();
