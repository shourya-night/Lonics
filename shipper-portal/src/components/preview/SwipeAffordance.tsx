import React from 'react';
import { ChevronUp } from 'lucide-react';

interface SwipeAffordanceProps {
  onTriggerUnlock: () => void;
  isDragging?: boolean;
}

export default function SwipeAffordance({
  onTriggerUnlock,
  isDragging = false,
}: SwipeAffordanceProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowUp') {
      e.preventDefault();
      onTriggerUnlock();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onTriggerUnlock}
      onKeyDown={handleKeyDown}
      aria-label="Swipe upward or press Enter to unlock Lonics Operating System"
      className="w-full shrink-0 flex flex-col items-center justify-center pt-2 pb-1 cursor-pointer select-none group focus:outline-none focus:ring-1 focus:ring-primary rounded-lg transition-colors hover:bg-muted/40 active:scale-[0.99]"
    >
      {/* Visual Grab Bar */}
      <div className="w-12 h-1 bg-muted-foreground/30 rounded-full mb-1.5 group-hover:bg-primary/60 transition-colors" />

      {/* Upward Indicator with Subtle Breathing Animation */}
      <div className="flex flex-col items-center gap-0.5">
        <ChevronUp
          className={`w-4 h-4 text-primary transition-transform duration-300 ${
            isDragging ? '-translate-y-1 scale-110 text-foreground' : 'animate-pulse'
          }`}
        />
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs sm:text-sm font-bold tracking-widest text-foreground group-hover:text-primary transition-colors">
            SWIPE TO ENTER
          </span>
        </div>
        <span className="text-[9px] font-mono text-muted-foreground tracking-wider">
          (OR CLICK / PRESS ENTER ↵)
        </span>
      </div>
    </div>
  );
}
