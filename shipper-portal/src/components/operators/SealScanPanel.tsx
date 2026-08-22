import { useState } from 'react';
import { Camera, Keyboard, ShieldCheck, ShieldAlert, Loader2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SealVerifier from '../SealVerifier';
import { verifySeal } from '../../utils/operatorLogic';
import { publishOperationalEvent } from '../../services/operationalEvents';

type SealScanMode = 'idle' | 'camera' | 'manual' | 'verified' | 'mismatch' | 'confirming';

interface SealScanPanelProps {
  expectedSealId: string;
  shipmentId: string;
  operatorId: string;
  operatorLocation: string;
  onVerified: (sealId: string) => void;
  onMismatch?: (scanned: string) => void;
}

export default function SealScanPanel({
  expectedSealId,
  shipmentId,
  operatorId,
  operatorLocation,
  onVerified,
  onMismatch,
}: SealScanPanelProps) {
  const [mode, setMode] = useState<SealScanMode>('idle');
  const [manualInput, setManualInput] = useState('');
  const [scannedSealId, setScannedSealId] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);

  const handleManualSubmit = async () => {
    if (!manualInput.trim()) return;
    const result = verifySeal(expectedSealId, manualInput.trim());
    const normalizedScanned = manualInput.trim().toUpperCase();
    setScannedSealId(normalizedScanned);

    if (result === 'VERIFIED') {
      setMode('verified');
    } else {
      setMode('mismatch');
      // Publish SEAL_MISMATCH event immediately
      setIsPublishing(true);
      try {
        await publishOperationalEvent({
          eventType: 'SEAL_MISMATCH',
          shipmentId,
          sealId: normalizedScanned,
          operatorId,
          location: operatorLocation,
          timestamp: new Date().toISOString(),
          metadata: { expected: expectedSealId, scanned: normalizedScanned },
        });
      } finally {
        setIsPublishing(false);
      }
      onMismatch?.(normalizedScanned);
    }
  };

  const handleCameraVerify = async (_bookingId: string) => {
    // SealVerifier calls back with bookingId on success (DELIVERED status from backend)
    setScannedSealId(expectedSealId); // camera path: backend confirmed match
    setMode('verified');
  };

  const handleConfirmReceipt = async () => {
    setMode('confirming');
    setIsPublishing(true);
    try {
      await publishOperationalEvent({
        eventType: 'CARGO_RECEIVED',
        shipmentId,
        sealId: scannedSealId || expectedSealId,
        operatorId,
        location: operatorLocation,
        timestamp: new Date().toISOString(),
        metadata: { verificationMethod: scannedSealId ? 'manual' : 'camera' },
      });
      onVerified(scannedSealId || expectedSealId);
    } catch (err) {
      console.error('[SealScanPanel] Failed to publish CARGO_RECEIVED:', err);
      setMode('verified'); // allow retry
    } finally {
      setIsPublishing(false);
    }
  };

  const reset = () => {
    setMode('idle');
    setManualInput('');
    setScannedSealId('');
    setIsPublishing(false);
  };

  return (
    <div className="bg-card border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
      {/* Panel Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm text-foreground">Seal Verification</h3>
          <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
            Expected: <span className="text-foreground font-bold">{expectedSealId}</span>
          </p>
        </div>
        {mode !== 'idle' && (
          <button
            type="button"
            onClick={reset}
            id="seal-scan-reset-btn"
            className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground hover:text-foreground transition cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* ── IDLE: Choose mode ── */}
        {mode === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-5 grid grid-cols-2 gap-3"
          >
            <button
              type="button"
              id="seal-scan-camera-btn"
              onClick={() => setMode('camera')}
              className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-dashed border-slate-300 dark:border-zinc-700 hover:border-primary/60 hover:bg-primary/5 transition duration-200 cursor-pointer group"
            >
              <Camera className="h-7 w-7 text-muted-foreground group-hover:text-primary transition" />
              <div className="text-center">
                <p className="text-xs font-bold text-foreground">Camera Scan</p>
                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">Use device camera</p>
              </div>
            </button>

            <button
              type="button"
              id="seal-scan-manual-btn"
              onClick={() => setMode('manual')}
              className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-dashed border-slate-300 dark:border-zinc-700 hover:border-primary/60 hover:bg-primary/5 transition duration-200 cursor-pointer group"
            >
              <Keyboard className="h-7 w-7 text-muted-foreground group-hover:text-primary transition" />
              <div className="text-center">
                <p className="text-xs font-bold text-foreground">Manual Entry</p>
                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">Type seal ID</p>
              </div>
            </button>
          </motion.div>
        )}

        {/* ── CAMERA: Reuse existing SealVerifier ── */}
        {mode === 'camera' && (
          <motion.div
            key="camera"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <SealVerifier
              activeBookingId={shipmentId}
              onVerifyComplete={handleCameraVerify}
              onClose={reset}
            />
          </motion.div>
        )}

        {/* ── MANUAL: Text input ── */}
        {mode === 'manual' && (
          <motion.div
            key="manual"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-5 space-y-4"
          >
            <div className="space-y-2">
              <label htmlFor="seal-manual-input" className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider">
                Enter Seal ID
              </label>
              <input
                id="seal-manual-input"
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                placeholder="e.g. SEAL-839201"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-zinc-700 bg-background text-foreground text-sm font-mono placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                autoFocus
              />
            </div>
            <button
              type="button"
              id="seal-manual-submit-btn"
              onClick={handleManualSubmit}
              disabled={!manualInput.trim()}
              className="w-full py-3 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
            >
              Verify Seal
            </button>
          </motion.div>
        )}

        {/* ── VERIFIED: Show confirmation ── */}
        {(mode === 'verified' || mode === 'confirming') && (
          <motion.div
            key="verified"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="p-5 space-y-4"
          >
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="p-4 bg-emerald-100 dark:bg-emerald-950/30 rounded-full">
                <ShieldCheck className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-emerald-700 dark:text-emerald-400">Seal Verified</p>
                <p className="text-[11px] font-mono text-muted-foreground mt-1">
                  {scannedSealId || expectedSealId} matches expected seal
                </p>
              </div>
            </div>

            <button
              type="button"
              id="seal-confirm-receipt-btn"
              onClick={handleConfirmReceipt}
              disabled={isPublishing || mode === 'confirming'}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/60 text-white font-bold text-sm rounded-xl active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {isPublishing
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Publishing Receipt...</>
                : 'Confirm Cargo Receipt'
              }
            </button>
          </motion.div>
        )}

        {/* ── MISMATCH: Show alert ── */}
        {mode === 'mismatch' && (
          <motion.div
            key="mismatch"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="p-5 space-y-4"
          >
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="p-4 bg-rose-100 dark:bg-rose-950/30 rounded-full">
                <ShieldAlert className="h-10 w-10 text-rose-600 dark:text-rose-400" />
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-rose-700 dark:text-rose-400">Seal Mismatch</p>
                <p className="text-[11px] font-mono text-muted-foreground mt-1">
                  Scanned <span className="font-bold text-foreground">{scannedSealId}</span> — expected <span className="font-bold text-foreground">{expectedSealId}</span>
                </p>
              </div>
            </div>

            <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/50 rounded-xl p-4 text-xs text-rose-700 dark:text-rose-400 space-y-1.5">
              <p className="font-bold">⚠ Mismatch event published to Lonics backend.</p>
              <p>Do not proceed with cargo receipt. Contact your supervisor or escalate to Mission Control.</p>
            </div>

            {isPublishing && (
              <div className="flex items-center justify-center gap-2 text-xs font-mono text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Publishing event...
              </div>
            )}

            <button
              type="button"
              id="seal-mismatch-retry-btn"
              onClick={reset}
              className="w-full py-3 border border-slate-300 dark:border-zinc-700 text-sm font-mono text-foreground rounded-xl hover:bg-muted transition cursor-pointer"
            >
              Try Again
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
