const apiKey = 'sb_publishable__NYEjekH8Q8Ek6XEwGpAsA_dDbCTdwQ';
const baseUrl = 'https://onqtnrkginxohmdjawca.supabase.co/rest/v1';

const candidates = {
  container_cache: [
    'window_id', 'current_cbm', 'current_kg', 'updated_at', 'created_at', 'shipper_id'
  ],
  shipments: [
    // snake_case
    'booking_id', 'assigned_window_id', 'chargeable_weight', 'total_cbm', 
    'base_price', 'contingency_buffer', 'final_quote', 'status', 'shipper_id',
    'origin', 'destination', 'cargo_items', 'created_at',
    // camelCase
    'bookingId', 'assignedWindowId', 'chargeableWeight', 'totalCbm', 
    'basePrice', 'contingencyBuffer', 'finalQuote', 'shipperId', 'cargoItems',
    // short names
    'id', 'price', 'weight', 'volume', 'route'
  ]
};

async function discover() {
  console.log('🚀 Starting Database Column Discovery...\n');
  
  for (const [table, cols] of Object.entries(candidates)) {
    console.log(`Table: "${table}"`);
    const validCols = [];
    
    for (const col of cols) {
      try {
        const res = await fetch(`${baseUrl}/${table}?select=${col}&limit=0`, {
          method: 'GET',
          headers: {
            'apikey': apiKey,
            'Authorization': `Bearer ${apiKey}`
          }
        });
        
        console.log(`  - Checking "${col}": Status ${res.status}`);
        if (res.status === 200) {
          validCols.push(col);
        }
      } catch (err) {
        console.error(`  - Error checking ${col}:`, err.message);
      }
    }
    
    console.log(`👉 Valid columns found in "${table}": [ ${validCols.join(', ')} ]\n`);
  }
}

discover();
