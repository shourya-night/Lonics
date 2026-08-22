import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, signInWithGoogle, fetchCurrentProfile } from '../lib/supabase';
import { ShieldCheck, AlertCircle, Loader2, Truck, Building2, Network, Zap } from 'lucide-react';

export default function OperatorLoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initialChecking, setInitialChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if already authenticated as an operator
  useEffect(() => {
    async function checkAuth() {
      try {
        const { user } = await fetchCurrentProfile();
        if (user) {
          const role = user.user_metadata?.operator_role;
          if (role === 'DRIVER') {
            navigate('/operators/driver', { replace: true });
          } else if (role === 'GROUND_OPERATOR') {
            navigate('/operators/ground', { replace: true });
          }
        }
      } catch (err) {
        console.warn('[OperatorLogin] Auth check:', err);
      } finally {
        setInitialChecking(false);
      }
    }

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const role = session.user.user_metadata?.operator_role;
        if (role === 'DRIVER') {
          navigate('/operators/driver', { replace: true });
        } else if (role === 'GROUND_OPERATOR') {
          navigate('/operators/ground', { replace: true });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
    } catch (err: any) {
      setError(err?.message || 'Failed to initialize Google authentication.');
      setLoading(false);
    }
  };

  const handleDevAccess = (role: 'DRIVER' | 'GROUND_OPERATOR') => {
    try {
      sessionStorage.setItem('lonics_operator_role', role);
      sessionStorage.setItem('lonics_preview_unlocked', 'true');
    } catch {
      // ignore storage errors
    }
    navigate(role === 'DRIVER' ? '/operators/driver' : '/operators/ground');
  };

  if (initialChecking) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-xs font-mono text-muted-foreground">Verifying Lonics authorization...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between font-sans px-6 py-12 selection:bg-primary/20">

      {/* Back link */}
      <div className="max-w-md w-full mx-auto">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 text-xs font-mono text-muted-foreground hover:text-foreground transition cursor-pointer mb-8"
        >
          <span>←</span>
          <span>Back to Lonics.com</span>
        </button>
      </div>

      {/* Main Auth Container */}
      <div className="max-w-md w-full mx-auto space-y-6 bg-card border border-slate-200 dark:border-zinc-800 p-8 md:p-10 rounded-2xl shadow-sm">

        {/* Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-3 rounded-xl bg-foreground text-background shadow-sm mb-1">
            <Network className="h-6 w-6" />
          </div>
          <div className="text-xs font-mono uppercase tracking-widest text-primary font-bold">
            LONICS OPERATOR PORTAL
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Operator Access
          </h1>
          <p className="text-sm text-muted-foreground">
            Drivers and Ground Operators sign in here.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/50 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Authentication Error</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Google OAuth */}
        <div className="space-y-3 pt-1">
          <button
            type="button"
            id="operator-google-login-btn"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-12 px-5 rounded-xl border border-border bg-card hover:bg-muted text-foreground font-semibold text-sm flex items-center justify-center gap-3 transition shadow-sm hover:shadow active:scale-[0.99] disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.27 21.36 7.36 24 12 24z" />
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.27 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
              </svg>
            )}
            <span>Continue with Google</span>
          </button>

          <p className="text-[11px] text-center font-mono text-muted-foreground">
            Your operator role will be verified from your Lonics account.
          </p>
        </div>

        {/* DEV ACCESS Section — only shown in non-production */}
        {!import.meta.env.PROD && (
          <div className="border-t border-dashed border-slate-200 dark:border-zinc-700 pt-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-slate-200 dark:bg-zinc-700" />
              <div className="flex items-center gap-1.5 px-2">
                <Zap className="h-3 w-3 text-amber-500" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">DEV ACCESS</span>
              </div>
              <div className="h-px flex-1 bg-slate-200 dark:bg-zinc-700" />
            </div>

            <p className="text-[10px] font-mono text-muted-foreground text-center">
              Skip auth for local development and demo purposes.
            </p>

            <button
              type="button"
              id="dev-access-driver-btn"
              onClick={() => handleDevAccess('DRIVER')}
              className="w-full h-11 px-4 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-mono font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Truck className="h-4 w-4" />
              Continue as Driver
            </button>

            <button
              type="button"
              id="dev-access-ground-op-btn"
              onClick={() => handleDevAccess('GROUND_OPERATOR')}
              className="w-full h-11 px-4 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-mono font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Building2 className="h-4 w-4" />
              Continue as Ground Operator
            </button>
          </div>
        )}

        {/* Footer security note */}
        <div className="pt-2 border-t border-border text-center space-y-1.5">
          <div className="flex items-center justify-center gap-1.5 font-mono text-[10px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>AUTHENTICATED VIA SUPABASE AUTH</span>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Operator access is role-verified. Unauthorized access is logged.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-md w-full mx-auto text-center text-xs text-muted-foreground font-mono">
        LONICS LOGISTICS OS · OPERATOR PORTAL
      </div>
    </div>
  );
}
