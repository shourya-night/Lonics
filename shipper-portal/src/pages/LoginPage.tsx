import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, signInWithGoogle, fetchCurrentProfile } from '../lib/supabase';
import { ShieldCheck, AlertCircle, Loader2, Network } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initialChecking, setInitialChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if already authenticated or returning from Google OAuth redirect
  useEffect(() => {
    async function checkAuth() {
      try {
        const { user, profile } = await fetchCurrentProfile();
        if (user) {
          if (profile?.onboarding_completed) {
            navigate('/app', { replace: true });
          } else {
            navigate('/onboarding', { replace: true });
          }
          return;
        }
      } catch (err: any) {
        console.warn('[Login Auth Check]', err);
      } finally {
        setInitialChecking(false);
      }
    }

    checkAuth();

    // Listen to Supabase auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const { profile } = await fetchCurrentProfile();
        if (profile?.onboarding_completed) {
          navigate('/app', { replace: true });
        } else {
          navigate('/onboarding', { replace: true });
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Google OAuth error:', err);
      setError(err?.message || 'Failed to initialize Google authentication. Please try again.');
      setLoading(false);
    }
  };

  if (initialChecking) {
    return (
      <div className="min-h-screen bg-[#FFFFFF] flex flex-col items-center justify-center font-sans">
        <Loader2 className="h-8 w-8 text-[#0284C7] animate-spin mb-4" />
        <p className="text-xs font-mono text-[#64748B]">Verifying Lonics authorization...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex flex-col justify-between font-sans text-[#0A192F] px-6 py-12 selection:bg-[#E0F2FE]">
      
      {/* Top wordmark */}
      <div className="max-w-md w-full mx-auto text-left">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-xs font-mono text-[#64748B] hover:text-[#0A192F] transition cursor-pointer mb-8"
        >
          <span>←</span>
          <span>Back to Lonics.com</span>
        </button>
      </div>

      {/* Main Auth Container */}
      <div className="max-w-md w-full mx-auto space-y-8 bg-[#F8FAFC] border border-[#E2E8F0] p-8 md:p-10 rounded-2xl shadow-sm">
        
        {/* Centered Lonics Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-3 rounded-xl bg-[#0A192F] text-[#FFFFFF] shadow-sm mb-1">
            <Network className="h-6 w-6" />
          </div>
          
          <div className="text-xs font-mono uppercase tracking-widest text-[#0284C7] font-bold">
            LONICS OPERATING SYSTEM
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0A192F] tracking-tight">
            Welcome to Lonics
          </h1>

          <p className="text-sm text-[#475569]">
            Your freight network starts here.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#DC2626] flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Authentication Notice</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Supabase Google OAuth Button */}
        <div className="space-y-4 pt-2">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-13 px-5 rounded-xl border border-[#CBD5E1] bg-[#FFFFFF] hover:bg-[#F8FAFC] text-[#0A192F] font-semibold text-sm flex items-center justify-center gap-3 transition shadow-sm hover:shadow active:scale-[0.99] disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-[#0284C7]" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.27 21.36 7.36 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.27 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
            )}
            <span>Continue with Google</span>
          </button>

          {/* Quick Demo Access for Testing & Evaluation */}
          <button
            type="button"
            onClick={() => {
              sessionStorage.setItem('lonics_demo_session', 'true');
              sessionStorage.setItem('lonics_preview_unlocked', 'true');
              navigate('/app');
            }}
            className="w-full h-11 px-4 rounded-xl border border-primary/40 bg-primary/10 hover:bg-primary/15 text-primary font-mono font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <span>⚡ Explore Mission Control Deck (Demo Shipper)</span>
          </button>
        </div>

        {/* Security / Enterprise Notice */}
        <div className="pt-4 border-t border-[#E2E8F0] space-y-2 text-center text-xs text-[#64748B]">
          <div className="flex items-center justify-center gap-1.5 font-mono text-[11px]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#0284C7]" />
            <span>AUTHENTICATED VIA SUPABASE AUTH</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            By signing in, you access the Lonics SME Multimodal Gateway under standard trade terms.
          </p>
        </div>

      </div>

      {/* Footer info */}
      <div className="max-w-md w-full mx-auto text-center text-xs text-[#94A3B8] font-mono">
        LONICS LOGISTICS OS • SECURE SHIELD
      </div>

    </div>
  );
}
