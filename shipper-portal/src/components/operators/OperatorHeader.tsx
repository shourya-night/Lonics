import { LogOut, Building2, Truck } from 'lucide-react';
import type { OperatorProfile } from '../../types/operator';

interface OperatorHeaderProps {
  profile: OperatorProfile;
  onSignOut: () => void;
}

export default function OperatorHeader({ profile, onSignOut }: OperatorHeaderProps) {
  const isDriver = profile.role === 'DRIVER';
  const roleLabel = isDriver ? 'DRIVER' : 'GROUND OPS';
  const roleColor = isDriver
    ? 'bg-amber-500/15 border-amber-400/40 text-amber-600 dark:text-amber-400'
    : 'bg-emerald-500/15 border-emerald-400/40 text-emerald-600 dark:text-emerald-400';
  const roleIconColor = isDriver ? 'text-amber-500' : 'text-emerald-500';

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 bg-card border-b border-slate-200 dark:border-zinc-800 px-4 py-3 shadow-sm">
      {/* Left: Brand + Role */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl font-extrabold tracking-tight text-foreground leading-none">
            LONICS
          </span>
          <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">OPS</span>
        </div>

        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono font-bold uppercase tracking-wider ${roleColor}`}>
          {isDriver
            ? <Truck className={`h-3 w-3 ${roleIconColor}`} />
            : <Building2 className={`h-3 w-3 ${roleIconColor}`} />
          }
          {roleLabel}
        </div>
      </div>

      {/* Right: Operator identity + sign out */}
      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-xs font-semibold text-foreground leading-tight">{profile.name}</p>
          <p className="text-[10px] font-mono text-muted-foreground leading-tight">
            {isDriver ? profile.vehicleId : profile.terminalId}
          </p>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          id="operator-sign-out-btn"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition duration-200 cursor-pointer"
          title="Sign Out"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
