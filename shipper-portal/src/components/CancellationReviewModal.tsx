import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  AlertTriangle,
  Truck,
  Train,
  Zap,
  Info,
  ArrowRight,
  Loader2,
  ShieldAlert,
  TrendingDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  calculateCancellationRefund,
  formatINR,
  type BookedLeg,
  type CancellationRefundSummary,
} from '../utils/cancellationEngine';

export interface CancellationReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: string;
  origin?: string;
  destination?: string;
  totalBookingAmount?: number;
  currentStatus?: string;
  transitProgress?: number;
  onConfirmCancellation: (summary: CancellationRefundSummary) => Promise<void>;
}

export default function CancellationReviewModal({
  isOpen,
  onClose,
  bookingId,
  origin = 'Mumbai Port DFC Gate-1',
  destination = 'Delhi ICD Terminal-3',
  totalBookingAmount = 12500,
  currentStatus = 'IN_TRANSIT',
  transitProgress = 65,
  onConfirmCancellation,
}: CancellationReviewModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Compute dynamic refund calculation based on live booking parameters
  const refundSummary = useMemo(() => {
    return calculateCancellationRefund({
      bookingId,
      origin,
      destination,
      totalAmount: totalBookingAmount,
      status: currentStatus,
      transitProgress,
    });
  }, [bookingId, origin, destination, totalBookingAmount, currentStatus, transitProgress]);

  // Handle ESC key to close modal safely
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  // Prevent background and page scrolling when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [isOpen]);

  const handleExecuteCancellation = async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      await onConfirmCancellation(refundSummary);
    } catch (err: any) {
      console.error('[CancellationModal] Cancellation failed:', err);
      setErrorMsg(
        err?.message || 'Cancellation request could not be processed. Please retry or contact support.'
      );
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/60 dark:bg-black/75 backdrop-blur-sm overflow-hidden select-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancellation-modal-title"
        onClick={(e) => {
          // Backdrop click safely closes review without cancelling
          if (e.target === e.currentTarget && !isProcessing) {
            onClose();
          }
        }}
      >
        {/* Modal Dialog Box — Strict 3-part layout constrained to viewport */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="relative w-full max-w-2xl bg-card border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-24px)] sm:max-h-[calc(100dvh-32px)] md:max-h-[min(760px,calc(100dvh-48px))] overflow-hidden select-text text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── PART 1: PINNED HEADER (shrink-0) ── */}
          <header className="shrink-0 flex items-start justify-between p-4 sm:p-5 md:p-6 border-b border-slate-200 dark:border-zinc-800 bg-muted/25">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-md bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </span>
                <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-rose-500">
                  CANCELLATION & REFUND REVIEW
                </span>
              </div>
              <h2 id="cancellation-modal-title" className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                Cancel Cargo
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground leading-snug">
                Review your cancellation, applicable deductions, and estimated refund before continuing.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              aria-label="Close cancellation review overlay"
              className="p-2 -mr-1 -mt-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition cursor-pointer disabled:opacity-50"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </header>

          {/* ── PART 2: SCROLLABLE CONTENT BODY (flex-1 min-h-0 overflow-y-auto) ── */}
          <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 md:p-6 space-y-5">
            {/* Active Booking Identifier Badge */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/30 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">BOOKING ID:</span>
                <span className="font-bold text-foreground">{bookingId}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">CORRIDOR:</span>
                <span className="font-semibold text-foreground truncate max-w-[240px]">
                  {origin.replace(' DFC Gate-1', '')} ➔ {destination.replace(' Terminal-3', '')}
                </span>
              </div>
            </div>

            {/* Error Notification (if any) */}
            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-xs text-rose-600 dark:text-rose-400">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">Cancellation Failed</p>
                  <p>{errorMsg}</p>
                </div>
              </div>
            )}

            {/* SECTION 1: Booked Routes & Affected Legs */}
            <section className="space-y-2.5">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Train className="h-3.5 w-3.5 text-primary" />
                  Booked Routes & Affected Legs ({refundSummary.legs.length})
                </h3>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {refundSummary.cancellableLegsCount} cancellable • {refundSummary.nonCancellableLegsCount} non-refundable
                </span>
              </div>

              <div className="space-y-2">
                {refundSummary.legs.map((leg: BookedLeg) => (
                  <div
                    key={leg.id}
                    className={`p-3 rounded-xl border transition-all ${
                      leg.isCancelable
                        ? 'bg-card border-slate-200 dark:border-zinc-800'
                        : 'bg-muted/20 border-slate-200/50 dark:border-zinc-800/50 opacity-80'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`p-1 rounded text-[10px] font-mono font-bold flex items-center gap-1 ${
                              leg.mode === 'RAIL'
                                ? 'bg-primary/10 text-primary'
                                : leg.mode === 'E_LCV'
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : 'bg-blue-500/10 text-blue-500'
                            }`}
                          >
                            {leg.mode === 'RAIL' && <Train className="h-3 w-3" />}
                            {leg.mode === 'ROAD' && <Truck className="h-3 w-3" />}
                            {leg.mode === 'E_LCV' && <Zap className="h-3 w-3" />}
                            {leg.mode}
                          </span>
                          <span className="font-semibold text-xs text-foreground">{leg.name}</span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                          <span>{leg.from}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span>{leg.to}</span>
                        </div>
                      </div>

                      {/* Leg Financials & Status */}
                      <div className="text-right space-y-0.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase border ${
                            leg.status === 'COMPLETED'
                              ? 'bg-muted text-muted-foreground border-border'
                              : leg.status === 'IN_TRANSIT'
                              ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          }`}
                        >
                          {leg.statusLabel}
                        </span>
                        <div className="text-xs font-mono">
                          <span className="text-muted-foreground">Booking: </span>
                          <span className="font-bold text-foreground">{formatINR(leg.legAmount)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Breakdown details per leg */}
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-muted-foreground">
                      <span className="text-[10px] leading-tight max-w-[340px]">{leg.explanation}</span>
                      <div className="flex items-center gap-2.5">
                        <span>Deduction: <span className="text-rose-500 font-semibold">−{formatINR(leg.deductionAmount)}</span></span>
                        <span>Refund: <span className="text-emerald-500 font-bold">{formatINR(leg.refundableAmount)}</span></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* SECTION 2: Refund Policy */}
            <section className="p-3.5 bg-muted/20 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-2">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-sky-500" />
                Refund Policy & Compensation Rules
              </h4>
              <ul className="space-y-1 text-xs text-muted-foreground leading-relaxed">
                {refundSummary.policyNotes.map((note, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* SECTION 3: Compact Financial Refund Summary */}
            <section className="p-4 bg-gradient-to-br from-card via-card to-primary/5 border border-primary/30 rounded-xl shadow-md space-y-3">
              <div className="flex justify-between items-center border-b border-border/80 pb-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
                  Financial Refund Breakdown
                </span>
                <span className="text-[10px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20 font-bold">
                  {refundSummary.refundPercentage}% REFUNDABLE
                </span>
              </div>

              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Original Booking Amount</span>
                  <span className="text-sm font-semibold text-foreground">{formatINR(refundSummary.totalBookingAmount)}</span>
                </div>

                <div className="flex justify-between items-center text-rose-500 dark:text-rose-400">
                  <span>Cancellation & Operational Deductions</span>
                  <span className="text-sm font-semibold">−{formatINR(refundSummary.totalDeductions)}</span>
                </div>
              </div>

              {/* Prominent Highlighted Estimated Refund */}
              <div className="pt-2.5 border-t border-border flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary">
                    ESTIMATED REFUND
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    Direct instant reversal to source SME account
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl sm:text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
                    {formatINR(refundSummary.estimatedRefund)}
                  </span>
                </div>
              </div>
            </section>
          </main>

          {/* ── PART 3: PINNED FOOTER (shrink-0) ── */}
          <footer className="shrink-0 p-3.5 sm:p-4 md:p-5 border-t border-slate-200 dark:border-zinc-800 bg-muted/25 flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              id="cancellation-keep-booking-btn"
              className="w-full sm:w-auto px-4 py-2.5 sm:py-3 rounded-xl border border-slate-300 dark:border-zinc-700 bg-card hover:bg-muted text-foreground font-semibold text-xs transition cursor-pointer disabled:opacity-50"
            >
              Keep Booking
            </button>

            <button
              type="button"
              onClick={handleExecuteCancellation}
              disabled={isProcessing || !refundSummary.canExecuteCancellation}
              id="cancellation-confirm-destructive-btn"
              className="w-full sm:w-auto px-5 py-2.5 sm:py-3 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-md shadow-rose-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing Cancellation...</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-4 w-4" />
                  <span>Cancel Routes & Refund {formatINR(refundSummary.estimatedRefund)}</span>
                </>
              )}
            </button>
          </footer>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
