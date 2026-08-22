import { useState } from 'react';
import { ArrowRight, CheckCircle, Clock, AlertTriangle, Loader2, TrendingDown, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ReturnAction, BackhaulOffer } from '../../types/operator';
import { acceptBackhaul, declineBackhaul } from '../../services/returnExchangeAgent';

interface ReturnExchangeCardProps {
  returnAction?: ReturnAction | null;
  backhaulOffer?: BackhaulOffer | null;
  operatorId: string;
  operatorRole: 'DRIVER' | 'GROUND_OPERATOR';
}

type BackhaulState = 'idle' | 'loading' | 'accepted' | 'declined' | 'invalid';

export default function ReturnExchangeCard({
  returnAction,
  backhaulOffer,
  operatorId,
  operatorRole,
}: ReturnExchangeCardProps) {
  const [backhaulState, setBackhaulState] = useState<BackhaulState>('idle');

  const handleAccept = async () => {
    if (!backhaulOffer) return;
    setBackhaulState('loading');
    const result = await acceptBackhaul(backhaulOffer.offerId, operatorId);
    setBackhaulState(result === 'ACCEPTED' ? 'accepted' : 'invalid');
  };

  const handleDecline = async () => {
    if (!backhaulOffer) return;
    setBackhaulState('loading');
    await declineBackhaul(backhaulOffer.offerId, operatorId);
    setBackhaulState('declined');
  };

  // Nothing to render
  if (!returnAction && !backhaulOffer) return null;

  const discountPct = backhaulOffer ? Math.round(backhaulOffer.discountRate * 100) : 0;
  const expiryMins = backhaulOffer
    ? Math.max(0, Math.round((new Date(backhaulOffer.expiresAt).getTime() - Date.now()) / 60000))
    : 0;

  return (
    <div className="space-y-4">
      {/* ── Return Action Card ── */}
      {returnAction && (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/50 rounded-2xl overflow-hidden shadow-sm">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-rose-200 dark:border-rose-800/50">
            <div className="p-2 bg-rose-100 dark:bg-rose-950/40 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-rose-700 dark:text-rose-300">Return Exchange — Active</h3>
              <p className="text-[10px] font-mono text-rose-600/80 dark:text-rose-400/80 uppercase tracking-wider">
                {returnAction.issueType} · Leg {returnAction.consolidationLeg}
              </p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Isolation info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-rose-100 dark:bg-rose-900/30 rounded-xl p-3 space-y-1 text-center">
                <p className="text-[9px] font-mono uppercase tracking-wider text-rose-600 dark:text-rose-400">Affected Pallets</p>
                <p className="text-2xl font-extrabold text-rose-700 dark:text-rose-300">{returnAction.affectedPallets}</p>
                <p className="text-[10px] font-mono text-rose-600/80 dark:text-rose-400/80">→ RETURN</p>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-3 space-y-1 text-center border border-emerald-200 dark:border-emerald-800/30">
                <p className="text-[9px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Continuing Legs</p>
                <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">{returnAction.unaffectedLegs.length}</p>
                <p className="text-[10px] font-mono text-emerald-600/80 dark:text-emerald-400/80">→ CONTINUE</p>
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-2">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Operator Instructions</p>
              <ol className="space-y-2">
                {returnAction.instructions.map((inst, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-foreground">
                    <span className="flex-shrink-0 h-5 w-5 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-[10px] font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{inst}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Documentation status */}
            <div className="border-t border-rose-200 dark:border-rose-800/50 pt-3 space-y-1.5">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Documentation</p>
              {[
                { label: 'Return Initiated', done: returnAction.documentationStatus.returnInitiated },
                { label: 'Documents Prepared', done: returnAction.documentationStatus.documentsPrepared },
                { label: 'E-Way Bill Part B Update', done: !returnAction.documentationStatus.ewayBillPending },
                { label: 'Return Movement Assigned', done: returnAction.documentationStatus.movementAssigned },
              ].map(({ label, done }) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <CheckCircle className={`h-3.5 w-3.5 flex-shrink-0 ${done ? 'text-emerald-500' : 'text-muted-foreground/40'}`} />
                  <span className={done ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
                  {!done && <span className="text-[10px] font-mono text-amber-500">Pending</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Backhaul Offer Card (Driver only) ── */}
      {backhaulOffer && operatorRole === 'DRIVER' && (
        <div className="bg-card border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-zinc-800 bg-primary/5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
                <TrendingDown className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Backhaul Offer</h3>
                <p className="text-[10px] font-mono text-primary uppercase tracking-wider">{discountPct}% off — Return Exchange Agent</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-amber-600 dark:text-amber-400">
              <Clock className="h-3 w-3" />
              <span>Expires {expiryMins}m</span>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Route */}
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <div className="flex items-center gap-1.5 min-w-0">
                <Package className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="truncate">{backhaulOffer.backhaulRoute.from}</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate text-right">{backhaulOffer.backhaulRoute.to}</span>
            </div>

            {/* Cargo info + Pricing */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-muted/30 rounded-xl p-3 border border-slate-200 dark:border-zinc-800">
                <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Cargo</p>
                <p className="text-base font-bold text-foreground">{backhaulOffer.cargoWeightTonnes}t</p>
              </div>
              <div className="bg-muted/30 rounded-xl p-3 border border-slate-200 dark:border-zinc-800">
                <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">Original</p>
                <p className="text-base font-bold text-muted-foreground line-through">
                  ₹{backhaulOffer.originalPrice.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="bg-primary/10 rounded-xl p-3 border border-primary/30">
                <p className="text-[9px] font-mono uppercase tracking-wider text-primary">You Earn</p>
                <p className="text-base font-bold text-primary">
                  ₹{backhaulOffer.discountedPrice.toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            {/* Compatibility reasons */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Why This Offer</p>
              {backhaulOffer.compatibilityReasons.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                  <CheckCircle className="h-3 w-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span>{r}</span>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <AnimatePresence mode="wait">
              {backhaulState === 'idle' && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-2 gap-3"
                >
                  <button
                    type="button"
                    id="backhaul-decline-btn"
                    onClick={handleDecline}
                    className="py-3 rounded-xl border border-slate-300 dark:border-zinc-700 text-sm font-mono text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    id="backhaul-accept-btn"
                    onClick={handleAccept}
                    className="py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 active:scale-[0.99] transition cursor-pointer"
                  >
                    Accept Offer
                  </button>
                </motion.div>
              )}

              {backhaulState === 'loading' && (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center py-4 gap-2 text-sm font-mono text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </motion.div>
              )}

              {backhaulState === 'accepted' && (
                <motion.div key="accepted" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center justify-center gap-2 py-3 bg-emerald-100 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/50 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle className="h-4 w-4" />
                  Backhaul Confirmed!
                </motion.div>
              )}

              {backhaulState === 'declined' && (
                <motion.div key="declined" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-3 text-xs font-mono text-muted-foreground">
                  Offer declined. Return Exchange Agent notified.
                </motion.div>
              )}

              {backhaulState === 'invalid' && (
                <motion.div key="invalid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-2 py-3 bg-rose-100 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-800/50 text-sm text-rose-700 dark:text-rose-400">
                  <AlertTriangle className="h-4 w-4" />
                  Offer expired or invalid
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
