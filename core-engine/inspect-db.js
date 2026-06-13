import { supabase } from './supabase.js';

async function testRLS() {
  console.log('Testing RLS bypass strategies...\n');

  // Strategy 1: Insert to shipments without shipper_id
  const tempBooking1 = `BK-TEST-1-${Date.now()}`;
  try {
    const { data, error } = await supabase
      .from('shipments')
      .insert({
        booking_id: tempBooking1,
        assigned_window_id: 'WIN-PRIMARY-DFC',
        chargeable_weight: 10.0,
        total_cbm: 0.5,
        final_quote: 100.0,
        status: 'RESERVATION_INITIATED'
      })
      .select();

    if (error) {
      console.log('Strategy 1 (No shipper_id) failed:', error.message);
    } else {
      console.log('Strategy 1 SUCCESS:', data);
      await supabase.from('shipments').delete().eq('booking_id', tempBooking1);
    }
  } catch (err) {
    console.log('Strategy 1 Exception:', err.message);
  }

  // Strategy 2: Anonymous Sign In and then insert
  console.log('\nTrying anonymous sign-in...');
  try {
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
    if (authError) {
      console.log('Anonymous Sign-In failed:', authError.message);
    } else {
      console.log('Anonymous Sign-In SUCCESS! User ID:', authData.user?.id);
      
      // Try insert with user ID as shipper_id
      const tempBooking2 = `BK-TEST-2-${Date.now()}`;
      const { data, error } = await supabase
        .from('shipments')
        .insert({
          booking_id: tempBooking2,
          assigned_window_id: 'WIN-PRIMARY-DFC',
          chargeable_weight: 10.0,
          total_cbm: 0.5,
          final_quote: 100.0,
          status: 'RESERVATION_INITIATED',
          shipper_id: authData.user?.id // use user ID!
        })
        .select();

      if (error) {
        console.log('Insert after auth failed:', error.message);
      } else {
        console.log('Insert after auth SUCCESS:', data);
        await supabase.from('shipments').delete().eq('booking_id', tempBooking2);
      }
    }
  } catch (err) {
    console.log('Auth strategy Exception:', err.message);
  }
}

testRLS();
