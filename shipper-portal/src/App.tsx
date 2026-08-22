import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import OnboardingPage from './pages/OnboardingPage';
import MissionControlDeck from './components/MissionControlDeck';
import OperationalPreviewScreen from './components/preview/OperationalPreviewScreen';
import OperatorLoginPage from './pages/OperatorLoginPage';
import DriverDashboard from './pages/DriverDashboard';
import GroundOpsDashboard from './pages/GroundOpsDashboard';
import { fetchCurrentProfile, signOutUser, supabase } from './lib/supabase';
import type { UserProfile } from './lib/supabase';
import { Loader2 } from 'lucide-react';

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  // 1. Canonical Authentication State
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // 2. Operational Lock Screen Unlock State (session-scoped)
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('lonics_preview_unlocked') === 'true';
    } catch {
      return false;
    }
  });

  const handleUnlock = useCallback(() => {
    setIsUnlocked(true);
    try {
      sessionStorage.setItem('lonics_preview_unlocked', 'true');
    } catch {
      // ignore storage error
    }
  }, []);

  const handleOpenPreview = useCallback(() => {
    setIsUnlocked(false);
    try {
      sessionStorage.removeItem('lonics_preview_unlocked');
    } catch {
      // ignore
    }
  }, []);

  // Listen for secondary Preview OS triggers inside the authenticated app
  useEffect(() => {
    const handleReopen = () => handleOpenPreview();
    window.addEventListener('lonics:open-preview', handleReopen);
    return () => window.removeEventListener('lonics:open-preview', handleReopen);
  }, [handleOpenPreview]);

  // Check canonical Supabase auth session
  useEffect(() => {
    async function loadSession() {
      try {
        const { user: authUser, profile: fetchedProfile } = await fetchCurrentProfile();
        setUser(authUser);
        if (fetchedProfile) {
          setProfile(fetchedProfile);
        } else if (authUser) {
          setProfile({
            user_id: authUser.id,
            full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Shipper',
            email: authUser.email || '',
            business_name: authUser.user_metadata?.business_name || '',
            business_categories: authUser.user_metadata?.business_categories || [],
            city: authUser.user_metadata?.city || '',
            state: authUser.user_metadata?.state || '',
            country: authUser.user_metadata?.country || 'India',
            onboarding_completed: !!authUser.user_metadata?.onboarding_completed,
          });
        } else if (sessionStorage.getItem('lonics_demo_session') === 'true') {
          setUser({ id: 'demo-user-01', email: 'shipper@lonics-logistics.in' });
          setProfile({
            user_id: 'demo-user-01',
            full_name: 'Verified SME Shipper',
            email: 'shipper@lonics-logistics.in',
            business_name: 'Bharat Precision Assemblies Ltd.',
            business_categories: ['Engineering & Automotive'],
            city: 'Mumbai',
            state: 'Maharashtra',
            country: 'India',
            onboarding_completed: true,
          });
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.warn('[Lonics Auth Resolution]', err);
      } finally {
        setAuthLoading(false);
      }
    }

    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setIsUnlocked(false);
        try {
          sessionStorage.removeItem('lonics_preview_unlocked');
        } catch {
          // ignore
        }
      } else if (session?.user) {
        setUser(session.user);
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
      setUser(null);
      setProfile(null);
      setIsUnlocked(false);
      try {
        sessionStorage.removeItem('lonics_preview_unlocked');
        sessionStorage.removeItem('lonics_demo_session');
      } catch {
        // ignore
      }
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Failed to sign out:', err);
    }
  };

  const handleNavigateLanding = () => {
    navigate('/');
  };

  const isAuthenticated = Boolean(user);

  // 3. Initial Auth Loading State (No preview or authenticated screen flash)
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center font-sans">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
        <p className="text-xs font-mono text-muted-foreground">Verifying Lonics authorization...</p>
      </div>
    );
  }

  // 4. Authenticated Application Deck wrapper with Operational Preview lock screen
  const isAppDeckRoute = location.pathname.startsWith('/app') || location.pathname.startsWith('/dashboard');

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Underlying Application Routes */}
      <div className="min-h-screen">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/app" replace /> : <LoginPage />}
          />
          <Route
            path="/onboarding"
            element={isAuthenticated ? <OnboardingPage /> : <Navigate to="/login" replace />}
          />
          <Route
            path="/app"
            element={
              isAuthenticated ? (
                <MissionControlDeck
                  userProfile={profile}
                  onSignOut={handleSignOut}
                  onNavigateLanding={handleNavigateLanding}
                />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route path="/operators/login" element={<OperatorLoginPage />} />
          <Route
            path="/operators/driver"
            element={
              <DriverRoleGuard>
                <DriverDashboard />
              </DriverRoleGuard>
            }
          />
          <Route
            path="/operators/ground"
            element={
              <GroundRoleGuard>
                <GroundOpsDashboard />
              </GroundRoleGuard>
            }
          />
          <Route path="/dashboard" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {/* Operational Preview Screen - Strictly gated to authenticated users on the operational deck */}
      {isAuthenticated && isAppDeckRoute && !isUnlocked && (
        <OperationalPreviewScreen onUnlock={handleUnlock} />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Operator Role Guards
// ──────────────────────────────────────────────────────────

function getOperatorRole(): string | null {
  try {
    return sessionStorage.getItem('lonics_operator_role');
  } catch {
    return null;
  }
}

function DriverRoleGuard({ children }: { children: React.ReactNode }) {
  const role = getOperatorRole();
  if (role !== 'DRIVER') {
    return <Navigate to="/operators/login" replace />;
  }
  return <>{children}</>;
}

function GroundRoleGuard({ children }: { children: React.ReactNode }) {
  const role = getOperatorRole();
  if (role !== 'GROUND_OPERATOR') {
    return <Navigate to="/operators/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
