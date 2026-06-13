import dotenv from 'dotenv';
dotenv.config();

const url = 'https://onqtnrkginxohmdjawca.supabase.co/rest/v1/';
const apiKey = process.env.SUPABASE_KEY || 'sb_publishable__NYEjekH8Q8Ek6XEwGpAsA_dDbCTdwQ';

async function inspectSchema() {
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const doc = await res.json();
    console.log('--- SUPABASE DATABASE SCHEMA DOCUMENTATION ---');
    console.log('Paths available:', Object.keys(doc.paths));
    
    if (doc.definitions) {
      console.log('\nTable Definitions:');
      for (const [tableName, definition] of Object.entries(doc.definitions)) {
        console.log(`\nTable: "${tableName}"`);
        console.log('Columns:');
        for (const [colName, colDef] of Object.entries(definition.properties || {})) {
          console.log(`  - ${colName} (${colDef.type}) - ${colDef.description || ''}`);
        }
      }
    }
  } catch (err) {
    console.error('Failed to retrieve schema:', err);
  }
}

inspectSchema();
