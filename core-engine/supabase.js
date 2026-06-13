import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Explicitly target the centralized root .env file
dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Supabase] WARNING: Missing SUPABASE_URL or SUPABASE_ANON_KEY in root environment config.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
console.log(`[Supabase] Client initialized with URL: ${supabaseUrl}`);
