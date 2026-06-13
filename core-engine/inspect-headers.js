import dotenv from 'dotenv';
dotenv.config();

const apiKey = 'sb_publishable__NYEjekH8Q8Ek6XEwGpAsA_dDbCTdwQ';
const baseUrl = 'https://onqtnrkginxohmdjawca.supabase.co/rest/v1';

async function inspectHeaders() {
  const endpoints = ['/container_cache', '/shipments'];
  
  for (const ep of endpoints) {
    console.log(`\nFetching headers for ${ep}...`);
    try {
      const res = await fetch(`${baseUrl}${ep}?limit=0`, {
        method: 'GET',
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'Range': '0-0',
          'Prefer': 'count=exact'
        }
      });
      
      console.log(`Status: ${res.status} ${res.statusText}`);
      const headers = {};
      res.headers.forEach((value, key) => {
        headers[key] = value;
      });
      console.log('Headers:', headers);
      
      const text = await res.text();
      console.log('Body:', text);
    } catch (err) {
      console.error(`Error fetching ${ep}:`, err.message);
    }
  }
}

inspectHeaders();
