import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, ScanLine } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import OperatorHeader from '../components/operators/OperatorHeader';
import ShipmentInfoCard from '../components/operators/ShipmentInfoCard';
import SealScanPanel from '../components/operators/SealScanPanel';
import ReturnExchangeCard from '../components/operators/ReturnExchangeCard';
import { getReturnActions } from '../services/returnExchangeAgent';
import { transitionShipmentStatus } from '../utils/operatorLogic';
import { DEMO_GROUND_OP, DEMO_SHIPMENT } from '../data/operatorDemoData';
import type { ShipmentLifecycleStatus } from '../types/operator';

function useOperatorRoleGuard(requiredRole: 'DRIVER' | 'GROUND_OPERATOR') {
  const navigate = useNavigate();
  const role = (() => {
    try { return sessionStorage.getItem('lonics_operator_role'); } catch { return null; }
  })();
  if (role !== requiredRole) {
    setTimeout(() => navigate('/operators/login', { replace: true }), 0);
    return false;
  }
  return true;
}

type GroundOpsPhase = 'scan' | 'review' | 'confirmed';

export default function GroundOpsDashboard() {
  const navigate = useNavigate();
  const isAuthorized = useOperatorRoleGuard('GROUND_OPERATOR');

  const [phase, setPhase] = useState<GroundOpsPhase>('scan');
  const [shipment, setShipment] = useState({
    ...DEMO_SHIPMENT,
    status: 'ARRIVED_AT_DROP' as ShipmentLifecycleStatus,
  });
  const [verifiedSealId, setVerifiedSealId] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);

  const returnAction = getReturnActions(shipment.shipmentId);

  const handleSignOut = useCallback(() => {
    try { sessionStorage.removeItem('lonics_operator_role'); } catch { /* ignore */ }
    navigate('/operators/login', { replace: true });
  }, [navigate]);

  const handleSealVerified = useCallback((sealId: string) => {
    setVerifiedSealId(sealId);
    setPhase('review');
  }, []);

  const handleSealMismatch = useCallback((scanned: string) => {
    console.log(`[GroundOps] Seal mismatch: scanned ${scanned}`);
    // Stay on scan phase — SealScanPanel shows the mismatch UI
  }, []);

  const handleConfirmReceipt = useCallback(async () => {
    setIsConfirming(true);
    try {
      const newStatus = transitionShipmentStatus(shipment.status, 'CARGO_RECEIVED');
      if (newStatus) {
        setShipment((prev) => ({
          ...prev,
          status: newStatus,
          seal: {
            ...prev.seal,
            verified: true,
            verifiedAt: new Date().toISOString(),
            verifiedBy: DEMO_GROUND_OP.operatorId,
          },
        }));
      }
      setConfirmedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setPhase('confirmed');
    } finally {
      setIsConfirming(false);
    }
  }, [shipment.status]);

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <OperatorHeader profile={DEMO_GROUND_OP} onSignOut={handleSignOut} />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-10">

        {/* Phase: SCAN */}
        <AnimatePresence mode="wait">
          {phase === 'scan' && (
            <motion.div
              key="scan"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              {/* Hero scan prompt */}
              <div className="bg-card border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 text-center space-y-2">
                <div className="inline-flex p-4 rounded-2xl bg-primary/10 border border-primary/20 mb-2">
                  <ScanLine className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Scan Cargo Seal</h2>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Use the camera or enter the seal ID manually to begin verification.
                </p>
              </div>

              {/* Seal Scan Panel */}
              <SealScanPanel
                expectedSealId={DEMO_SHIPMENT.seal.id}
                shipmentId={DEMO_SHIPMENT.shipmentId}
                operatorId={DEMO_GROUND_OP.operatorId}
                operatorLocation={DEMO_GROUND_OP.terminalId || 'Terminal'}
                onVerified={handleSealVerified}
                onMismatch={handleSealMismatch}
              />
            </motion.div>
          )}

          {/* Phase: REVIEW — show shipment info and confirm */}
          {phase === 'review' && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              {/* Verified banner */}
              <div className="flex items-center gap-3 px-5 py-4 bg-emerald-100 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl">
                <CheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="font-bold text-emerald-700 dark:text-emerald-300">Seal Verified</p>
                  <p className="text-[11px] font-mono text-emerald-600/80 dark:text-emerald-400/80">
                    {verifiedSealId} matches cargo record for {DEMO_SHIPMENT.shipmentId}
                  </p>
                </div>
              </div>

              {/* Full Shipment Card */}
              <ShipmentInfoCard shipment={shipment} />

              {/* Return Exchange — if active */}
              {returnAction && (
                <ReturnExchangeCard
                  returnAction={returnAction}
                  backhaulOffer={null}
                  operatorId={DEMO_GROUND_OP.operatorId}
                  operatorRole="GROUND_OPERATOR"
                />
              )}

              {/* Confirm Receipt */}
              <button
                type="button"
                id="ground-confirm-receipt-btn"
                onClick={handleConfirmReceipt}
                disabled={isConfirming}
                className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-base rounded-2xl shadow-md transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isConfirming
                  ? <><Loader2 className="h-5 w-5 animate-spin" /> Confirming Receipt...</>
                  : <><CheckCircle className="h-5 w-5" /> Confirm Cargo Receipt</>
                }
              </button>
            </motion.div>
          )}

          {/* Phase: CONFIRMED */}
          {phase === 'confirmed' && (
            <motion.div
              key="confirmed"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-5"
            >
              {/* Success */}
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-8 text-center space-y-4">
                <div className="inline-flex p-5 rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <CheckCircle className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300">
                    Cargo Received
                  </h2>
                  <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80 mt-1">
                    Shipment {DEMO_SHIPMENT.shipmentId} — confirmed at {confirmedAt}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center mt-4">
                  <div className="bg-emerald-100/60 dark:bg-emerald-900/20 rounded-xl p-3">
                    <p className="text-[9px] font-mono uppercase text-emerald-600/80">Seal</p>
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{verifiedSealId}</p>
                  </div>
                  <div className="bg-emerald-100/60 dark:bg-emerald-900/20 rounded-xl p-3">
                    <p className="text-[9px] font-mono uppercase text-emerald-600/80">Operator</p>
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{DEMO_GROUND_OP.name}</p>
                  </div>
                </div>

                <p className="text-[11px] font-mono text-emerald-600/70 dark:text-emerald-400/60">
                  CARGO_RECEIVED event published to Lonics Realtime
                </p>
              </div>

              {/* Show final shipment state */}
              <ShipmentInfoCard shipment={shipment} />

              {/* Scan another */}
              <button
                type="button"
                id="ground-scan-another-btn"
                onClick={() => {
                  setPhase('scan');
                  setVerifiedSealId(null);
                  setConfirmedAt(null);
                }}
                className="w-full py-3 border border-slate-300 dark:border-zinc-700 text-sm font-mono text-muted-foreground rounded-xl hover:bg-muted transition cursor-pointer"
              >
                Scan Another Shipment
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
