import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://onqtnrkginxohmdjawca.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable__NYEjekH8Q8Ek6XEwGpAsA_dDbCTdwQ';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Lonics Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export interface UserProfile {
  id?: string;
  user_id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  business_name: string;
  business_categories: string[];
  city: string;
  state: string;
  country: string;
  onboarding_completed: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Sign in with Google OAuth using Supabase Auth.
 */
export async function signInWithGoogle() {
  const redirectUrl = `${window.location.origin}/login`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    throw error;
  }
  return data;
}

/**
 * Sign out the currently active user.
 */
export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

/**
 * Get active user and profile directly from Supabase.
 */
export async function fetchCurrentProfile(): Promise<{
  user: any;
  profile: UserProfile | null;
}> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { user: null, profile: null };
  }

  // 1. Try fetching from profiles table
  try {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profileError && profileData) {
      return {
        user,
        profile: {
          id: profileData.id,
          user_id: profileData.user_id || user.id,
          full_name: profileData.full_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Shipper',
          email: profileData.email || user.email || '',
          avatar_url: profileData.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture,
          business_name: profileData.business_name || '',
          business_categories: Array.isArray(profileData.business_categories) ? profileData.business_categories : [],
          city: profileData.city || '',
          state: profileData.state || '',
          country: profileData.country || 'India',
          onboarding_completed: !!profileData.onboarding_completed,
          created_at: profileData.created_at,
          updated_at: profileData.updated_at,
        },
      };
    }
  } catch (err) {
    console.warn('[Lonics Supabase] Profile table fetch warning:', err);
  }

  // 2. Read from Supabase Auth user_metadata if profiles table is not yet migrated or empty
  const meta = user.user_metadata || {};
  const isCompleted = meta.onboarding_completed === true;

  const profileFromMeta: UserProfile = {
    user_id: user.id,
    full_name: meta.full_name || meta.name || user.email?.split('@')[0] || 'Shipper',
    email: user.email || '',
    avatar_url: meta.avatar_url || meta.picture,
    business_name: meta.business_name || '',
    business_categories: Array.isArray(meta.business_categories) ? meta.business_categories : [],
    city: meta.city || '',
    state: meta.state || '',
    country: meta.country || 'India',
    onboarding_completed: isCompleted,
  };

  return { user, profile: isCompleted || meta.business_name ? profileFromMeta : null };
}

/**
 * Persist SME profile directly to Supabase.
 * Updates Supabase profiles table AND Supabase Auth user_metadata on the Supabase backend.
 */
export async function persistProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Authentication required: No active Supabase user found.');
  }

  const payload: UserProfile = {
    user_id: user.id,
    full_name: profile.full_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Shipper',
    email: user.email || '',
    avatar_url: profile.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
    business_name: profile.business_name || '',
    business_categories: profile.business_categories || [],
    city: profile.city || '',
    state: profile.state || '',
    country: profile.country || 'India',
    onboarding_completed: true,
    updated_at: new Date().toISOString(),
  };

  // 1. Update Supabase Auth user_metadata on the Supabase server
  const { error: metaError } = await supabase.auth.updateUser({
    data: {
      business_name: payload.business_name,
      business_categories: payload.business_categories,
      city: payload.city,
      state: payload.state,
      country: payload.country,
      onboarding_completed: true,
      updated_at: payload.updated_at,
    },
  });

  if (metaError) {
    console.error('[Lonics Supabase] User metadata update failed:', metaError);
    throw new Error(`Failed to persist profile to Supabase auth: ${metaError.message}`);
  }

  // 2. Also try writing to profiles table if table exists
  try {
    const { error: tableError } = await supabase
      .from('profiles')
      .upsert(
        {
          user_id: user.id,
          full_name: payload.full_name,
          email: payload.email,
          avatar_url: payload.avatar_url,
          business_name: payload.business_name,
          business_categories: payload.business_categories,
          city: payload.city,
          state: payload.state,
          country: payload.country,
          onboarding_completed: true,
          updated_at: payload.updated_at,
        },
        { onConflict: 'user_id' }
      );

    if (tableError) {
      console.warn('[Lonics Supabase] Note: profiles table write had notice (auth user_metadata is updated):', tableError.message);
    }
  } catch (err) {
    console.warn('[Lonics Supabase] Profiles table upsert notice:', err);
  }

  return payload;
}
