import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { getOperationalPreviewData } from '../../data/previewData';
import PreviewHeader from './PreviewHeader';
import SwipeAffordance from './SwipeAffordance';
import ShipmentHistorySection from './ShipmentHistorySection';
import CurrentShipmentsSection from './CurrentShipmentsSection';
import RoutePredictionSection from './RoutePredictionSection';
import BillingSection from './BillingSection';

interface OperationalPreviewScreenProps {
  onUnlock: () => void;
}

export default function OperationalPreviewScreen({ onUnlock }: OperationalPreviewScreenProps) {
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const previewData = useMemo(() => getOperationalPreviewData(), []);

  // Motion value for vertical offset
  const y = useMotionValue(0);
  
  // Slight opacity fade as the preview is pulled away
  const opacity = useTransform(y, [0, -400], [1, 0.4]);

  // Check prefers-reduced-motion
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Smooth unlock execution
  const executeUnlock = useCallback(() => {
    if (isUnlocking) return;
    setIsUnlocking(true);

    if (prefersReducedMotion) {
      onUnlock();
      return;
    }

    // Dynamic viewport height measurement at runtime (never static)
    const currentHeight = typeof window !== 'undefined' ? window.innerHeight : 900;

    animate(y, -currentHeight, {
      duration: 0.45,
      ease: [0.16, 1, 0.3, 1],
      onComplete: () => {
        onUnlock();
      },
    });
  }, [isUnlocking, onUnlock, prefersReducedMotion, y]);

  // Keyboard accessibility (Enter, Space, ArrowUp)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        executeUnlock();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [executeUnlock]);

  // Handle Drag End with velocity and distance sensitivity
  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }
  ) => {
    setIsDragging(false);

    const draggedUpDistance = info.offset.y;
    const upwardVelocity = info.velocity.y;

    // Trigger unlock if dragged up > 90px OR upward flick velocity > 350 px/s
    if (draggedUpDistance < -90 || upwardVelocity < -350) {
      executeUnlock();
    } else {
      // Spring back to home position
      animate(y, 0, {
        type: 'spring',
        stiffness: 400,
        damping: 30,
      });
    }
  };

  return (
    <motion.div
      style={{ y, opacity }}
      drag={isUnlocking ? false : 'y'}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.65, bottom: 0 }}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      aria-modal="true"
      role="dialog"
      aria-label="Lonics Operational Lock Screen Preview"
      className="fixed inset-0 z-50 flex flex-col justify-between bg-background text-foreground overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing border-b border-border shadow-2xl"
    >
      {/* Background Subtle Operational Grid Texture adapting to active theme */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03] text-foreground bg-[linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] bg-[size:24px_24px]"
        aria-hidden="true"
      />

      {/* Main Container constrained to 100vh */}
      <div className="relative z-10 w-full max-w-7xl mx-auto h-full flex flex-col justify-between p-3 sm:p-5 md:p-6">
        {/* 1. Header */}
        <PreviewHeader telemetry={previewData.telemetry} />

        {/* 2. Operational Core: 2x2 Grid on Desktop / Vertical Stack on Mobile */}
        <main className="w-full flex-1 my-2 sm:my-3 min-h-0 flex flex-col justify-center">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3 md:gap-4 h-full max-h-[calc(100vh-140px)]">
            {/* Top-Left / Stack 1: Shipment History */}
            <div className="min-h-0">
              <ShipmentHistorySection shipments={previewData.shipmentHistory} />
            </div>

            {/* Top-Right / Stack 2: Current Shipments */}
            <div className="min-h-0">
              <CurrentShipmentsSection shipments={previewData.currentShipments} />
            </div>

            {/* Bottom-Left / Stack 3: Route Prediction & Forecast Chart */}
            <div className="min-h-0">
              <RoutePredictionSection prediction={previewData.routePrediction} />
            </div>

            {/* Bottom-Right / Stack 4: Billing & Expenditure */}
            <div className="min-h-0">
              <BillingSection billing={previewData.billing} />
            </div>
          </div>
        </main>

        {/* 3. Bottom Dedicated Swipe Affordance */}
        <SwipeAffordance onTriggerUnlock={executeUnlock} isDragging={isDragging} />
      </div>
    </motion.div>
  );
}
