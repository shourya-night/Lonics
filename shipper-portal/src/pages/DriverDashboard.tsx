import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, CheckCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import OperatorHeader from '../components/operators/OperatorHeader';
import ShipmentInfoCard from '../components/operators/ShipmentInfoCard';
import LiveRoutePanel from '../components/operators/LiveRoutePanel';
import ReturnExchangeCard from '../components/operators/ReturnExchangeCard';
import { publishOperationalEvent } from '../services/operationalEvents';
import { getReturnActions, getBackhaulOffers } from '../services/returnExchangeAgent';
import { transitionShipmentStatus } from '../utils/operatorLogic';
import { DEMO_DRIVER, DEMO_SHIPMENT } from '../data/operatorDemoData';
import type { ShipmentLifecycleStatus } from '../types/operator';

// ──────────────────────────────────────────────────────────
// Role Guard (inline — no separate file needed)
// ──────────────────────────────────────────────────────────

function useOperatorRoleGuard(requiredRole: 'DRIVER' | 'GROUND_OPERATOR') {
  const navigate = useNavigate();
  const role = (() => {
    try {
      return sessionStorage.getItem('lonics_operator_role');
    } catch {
      return null;
    }
  })();

  if (role !== requiredRole) {
    // Redirect to operator login if role doesn't match
    // Use a timeout to avoid rendering-phase navigation
    setTimeout(() => navigate('/operators/login', { replace: true }), 0);
    return false;
  }
  return true;
}

// ──────────────────────────────────────────────────────────
// Action buttons config — each maps to a lifecycle event
// ──────────────────────────────────────────────────────────

const LIFECYCLE_ACTIONS: {
  fromStatus: ShipmentLifecycleStatus;
  label: string;
  subLabel: string;
  eventType: any;
  nextStatus: ShipmentLifecycleStatus;
  color: string;
}[] = [
  {
    fromStatus: 'PENDING_PICKUP',
    label: 'Arrived at Pickup',
    subLabel: 'Mark arrival at origin terminal',
    eventType: 'ARRIVED_AT_PICKUP',
    nextStatus: 'ARRIVED_AT_PICKUP',
    color: 'bg-amber-500 hover:bg-amber-600 text-white',
  },
  {
    fromStatus: 'ARRIVED_AT_PICKUP',
    label: 'Confirm Pickup',
    subLabel: 'Cargo loaded and sealed',
    eventType: 'PICKUP_CONFIRMED',
    nextStatus: 'PICKUP_CONFIRMED',
    color: 'bg-sky-600 hover:bg-sky-700 text-white',
  },
  {
    fromStatus: 'PICKUP_CONFIRMED',
    label: 'Start Transit',
    subLabel: 'Departing origin terminal',
    eventType: 'IN_TRANSIT',
    nextStatus: 'IN_TRANSIT',
    color: 'bg-primary hover:bg-primary/90 text-primary-foreground',
  },
  {
    fromStatus: 'IN_TRANSIT',
    label: 'Arrived at Drop',
    subLabel: 'Mark arrival at destination',
    eventType: 'ARRIVED_AT_DROP',
    nextStatus: 'ARRIVED_AT_DROP',
    color: 'bg-violet-600 hover:bg-violet-700 text-white',
  },
  {
    fromStatus: 'ARRIVED_AT_DROP',
    label: 'Confirm Delivery',
    subLabel: 'Cargo handed off to ground ops',
    eventType: 'DELIVERY_CONFIRMED',
    nextStatus: 'DELIVERY_CONFIRMED',
    color: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
];

// ──────────────────────────────────────────────────────────
// Driver Dashboard Page
// ──────────────────────────────────────────────────────────

export default function DriverDashboard() {
  const navigate = useNavigate();
  const isAuthorized = useOperatorRoleGuard('DRIVER');

  const [shipment, setShipment] = useState(DEMO_SHIPMENT);
  const [isPublishing, setIsPublishing] = useState(false);
  const [lastEventLabel, setLastEventLabel] = useState<string | null>(null);

  const returnAction = getReturnActions(shipment.shipmentId);
  const backhaulOffers = getBackhaulOffers({
    from: shipment.origin.name,
    to: shipment.destination.name,
  });

  const handleSignOut = useCallback(() => {
    try {
      sessionStorage.removeItem('lonics_operator_role');
    } catch {
      // ignore
    }
    navigate('/operators/login', { replace: true });
  }, [navigate]);

  const handleLifecycleAction = useCallback(async (
    eventType: string,
    label: string
  ) => {
    // Validate transition
    const newStatus = transitionShipmentStatus(shipment.status, eventType as any);
    if (!newStatus) {
      console.warn(`[DriverDashboard] Invalid transition: ${shipment.status} + ${eventType}`);
      return;
    }

    setIsPublishing(true);
    try {
      await publishOperationalEvent({
        eventType: eventType as any,
        shipmentId: shipment.shipmentId,
        operatorId: DEMO_DRIVER.operatorId,
        location: eventType.includes('PICKUP')
          ? shipment.origin.name
          : shipment.destination.name,
        timestamp: new Date().toISOString(),
        metadata: { vehicleId: DEMO_DRIVER.vehicleId },
      });

      setShipment((prev) => ({ ...prev, status: newStatus }));
      setLastEventLabel(label);
    } finally {
      setIsPublishing(false);
    }
  }, [shipment]);

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  const currentAction = LIFECYCLE_ACTIONS.find((a) => a.fromStatus === shipment.status);
  const isTerminal = shipment.status === 'DELIVERY_CONFIRMED';

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <OperatorHeader profile={DEMO_DRIVER} onSignOut={handleSignOut} />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-10">
        {/* Last event toast */}
        <AnimatePresence>
          {lastEventLabel && (
            <motion.div
              key="event-toast"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="flex items-center gap-2 px-4 py-3 bg-emerald-100 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-sm font-semibold text-emerald-700 dark:text-emerald-400"
            >
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
              {lastEventLabel} event published to Lonics
            </motion.div>
          )}
        </AnimatePresence>

        {/* Shipment Info */}
        <ShipmentInfoCard shipment={shipment} />

        {/* Live Route + GPS */}
        <LiveRoutePanel
          driverId={DEMO_DRIVER.operatorId}
          shipmentId={shipment.shipmentId}
          origin={shipment.origin.name}
          destination={shipment.destination.name}
          eta={shipment.destination.scheduledTime}
        />

        {/* Location Confidence */}
        <div className="bg-card border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 flex gap-4">
          <div className="flex-1 text-center space-y-1 border-r border-border pr-4">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-amber-500" />
              <p className="text-[10px] font-mono uppercase tracking-wider">Estimated</p>
            </div>
            <p className="text-xs font-semibold text-foreground">GPS-derived position</p>
            <p className="text-[10px] font-mono text-muted-foreground">Route + telemetry prediction</p>
          </div>
          <div className="flex-1 text-center space-y-1 pl-4">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              <p className="text-[10px] font-mono uppercase tracking-wider">Verified</p>
            </div>
            <p className="text-xs font-semibold text-foreground">
              {shipment.seal.verifiedAt
                ? `Seal verified at ${new Date(shipment.seal.verifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Awaiting ground op scan'}
            </p>
            <p className="text-[10px] font-mono text-muted-foreground">Physical scan confirmation</p>
          </div>
        </div>

        {/* Lifecycle Action Button */}
        <div className="bg-card border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">Shipment Actions</h3>

          {isTerminal ? (
            <div className="flex items-center justify-center gap-2 py-6 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-6 w-6" />
              <span className="font-bold text-base">Delivery Confirmed</span>
            </div>
          ) : currentAction ? (
            <button
              type="button"
              id={`action-btn-${currentAction.eventType}`}
              onClick={() => handleLifecycleAction(currentAction.eventType, currentAction.label)}
              disabled={isPublishing}
              className={`w-full py-5 rounded-xl font-bold text-base active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 flex flex-col items-center gap-1.5 cursor-pointer shadow-sm ${currentAction.color}`}
            >
              {isPublishing
                ? <Loader2 className="h-6 w-6 animate-spin" />
                : <span className="text-xl">{currentAction.label}</span>
              }
              {!isPublishing && (
                <span className="text-sm opacity-80 font-normal">{currentAction.subLabel}</span>
              )}
            </button>
          ) : (
            <p className="text-xs font-mono text-muted-foreground text-center py-4">No action available for current status.</p>
          )}
        </div>

        {/* Return Exchange (only if active) */}
        {(returnAction || backhaulOffers.length > 0) && (
          <ReturnExchangeCard
            returnAction={returnAction}
            backhaulOffer={backhaulOffers[0] ?? null}
            operatorId={DEMO_DRIVER.operatorId}
            operatorRole="DRIVER"
          />
        )}
      </main>
    </div>
  );
}
