import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import MissionControlDeck from './components/MissionControlDeck';
import { fetchCurrentProfile, signOutUser, supabase } from './lib/supabase';
import type { UserProfile } from './lib/supabase';

function AppShell() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    async function loadSession() {
      try {
        const { user, profile: fetchedProfile } = await fetchCurrentProfile();
        if (fetchedProfile) {
          setProfile(fetchedProfile);
        } else if (user) {
          setProfile({
            user_id: user.id,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Shipper',
            email: user.email || '',
            business_name: user.user_metadata?.business_name || '',
            business_categories: user.user_metadata?.business_categories || [],
            city: user.user_metadata?.city || '',
            state: user.user_metadata?.state || '',
            country: user.user_metadata?.country || 'India',
            onboarding_completed: !!user.user_metadata?.onboarding_completed,
          });
        }
      } catch (err) {
        console.warn('[App Auth Loader]', err);
      }
    }

    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setProfile(null);
      } else if (session?.user) {
        const { profile: p } = await fetchCurrentProfile();
        if (p) setProfile(p);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setProfile(null);
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Failed to sign out:', err);
    }
  };

  const handleNavigateLanding = () => {
    navigate('/');
  };

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route
        path="/app"
        element={
          <MissionControlDeck
            userProfile={profile}
            onSignOut={handleSignOut}
            onNavigateLanding={handleNavigateLanding}
          />
        }
      />
      <Route path="/dashboard" element={<Navigate to="/app" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
