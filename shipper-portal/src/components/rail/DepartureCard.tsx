import React from 'react';
import type { RailDeparture } from '../../types/rail-booking';
import { formatINR } from '../../utils/railPricingEngine';
import { ArrowRight, Train, Users, ShieldCheck, Scale, MapPin } from 'lucide-react';

interface DepartureCardProps {
  departure: RailDeparture;
  onBook: (departure: RailDeparture) => void;
  onJoinWaitlist: (departure: RailDeparture) => void;
}

export const DepartureCard: React.FC<DepartureCardProps> = ({
  departure,
  onBook,
  onJoinWaitlist,
}) => {
  const isWaitlistOnly = departure.remainingSlots === 0;
  const isLowCapacity = departure.remainingSlots > 0 && departure.remainingSlots <= 4;
  const isLastSlot = departure.remainingSlots === 1;

  // Capacity percent for progress bar
  const capacityFillPercent = Math.round(
    ((departure.totalCapacitySlots - departure.remainingSlots) / departure.totalCapacitySlots) * 100
  );

  const pricing = departure.pricing;

  return (
    <div className="bg-card text-card-foreground border border-border rounded-xl p-4 sm:p-5 transition-all duration-200 hover:border-primary/40 shadow-sm space-y-4">
      {/* Top Meta: Date / Time + Rake */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-md bg-muted text-foreground border border-border/80">
            <Train className="h-3.5 w-3.5 text-primary" />
          </span>
          <span className="font-mono text-xs font-bold tracking-tight text-foreground uppercase">
            {departure.date} · {departure.time}
          </span>
        </div>
        <div className="text-[11px] font-mono text-muted-foreground">
          Rake <span className="text-foreground font-semibold">{departure.rakeNumber}</span> • {departure.operator}
        </div>
      </div>

      {/* Corridor Route */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-foreground">
          <span>{departure.origin}</span>
          <ArrowRight className="h-4 w-4 text-primary shrink-0" />
          <span>{departure.destination}</span>
        </div>
        <div className="text-[11px] font-mono text-muted-foreground flex flex-wrap gap-x-3 items-center">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3 text-primary" />
            <span>Gate: {departure.originTerminal}</span>
          </span>
          <span>→ Dest: {departure.destinationTerminal}</span>
        </div>
      </div>

      {/* Container Code, Distance & Tariff Specs */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-muted text-foreground font-bold border border-border">
            {departure.containerCode}
          </span>
          <span className="text-muted-foreground font-semibold">
            {departure.containerType}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground border-l border-border pl-2">
            <Scale className="h-3 w-3 text-primary/80" />
            <span>{departure.cargoWeightTonnes} t basis</span>
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground">
          Cut-off: <span className="text-foreground font-semibold">{departure.cutoffTime}</span>
        </div>
      </div>

      {/* Calculated Tariff-Derived Freight Card */}
      <div className="p-3 bg-muted/30 border border-border/80 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              {pricing?.estimateLabel || 'Estimated Rail Freight · Tariff Based'}
            </span>
            <span className="text-[9px] font-mono text-muted-foreground">
              ({pricing?.tariffMetadata?.tariffVersion || 'IR-CTO-2026.01'})
            </span>
          </div>
          <div className="text-[11px] font-mono text-muted-foreground">
            {departure.chargeableDistanceKm?.toLocaleString()} km chargeable rail • {pricing?.distanceBandLabel} • {pricing?.weightBandLabel}
          </div>
        </div>

        <div className="text-left sm:text-right">
          <div className="text-lg sm:text-xl font-bold font-mono text-foreground flex items-baseline gap-1 sm:justify-end">
            <span>{formatINR(pricing?.totalFreight || 0)}</span>
            {pricing?.isLCLSlot && (
              <span className="text-[10px] font-mono font-normal text-muted-foreground">
                / slot
              </span>
            )}
          </div>
          <div className="text-[9px] font-mono text-muted-foreground">
            {pricing?.isLCLSlot ? `(1/${pricing.slotCapacity} consolidated container slot)` : 'Full container haulage rate'}
          </div>
        </div>
      </div>

      {/* Capacity & Slot Remaining Indicator */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[11px] font-mono">
          <span className="text-muted-foreground font-semibold uppercase tracking-wider">
            Capacity Fill
          </span>
          <span className={`font-bold ${isWaitlistOnly ? 'text-sky-600 dark:text-sky-400' : isLastSlot || isLowCapacity ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
            {isWaitlistOnly ? '0 SLOTS REMAINING (WAITLIST ONLY)' : `${departure.remainingSlots} SLOTS REMAINING`}
          </span>
        </div>

        {/* Progress Track */}
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden border border-border/50">
          <div
            className={`h-full transition-all duration-300 ${
              isWaitlistOnly
                ? 'bg-sky-500'
                : isLastSlot
                  ? 'bg-amber-500'
                  : isLowCapacity
                    ? 'bg-amber-500'
                    : 'bg-primary'
            }`}
            style={{ width: isWaitlistOnly ? '100%' : `${capacityFillPercent}%` }}
          />
        </div>
      </div>

      {/* Bottom Bar: Status Badge + Action CTA Button */}
      <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-border/60">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {isWaitlistOnly ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800/80">
                <Users className="h-3.5 w-3.5" />
                {departure.statusLabel}
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                {departure.waitlistCount} {departure.waitlistCount === 1 ? 'shipment' : 'shipments'} ahead
              </span>
            </div>
          ) : isLastSlot ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800/80">
              LAST SLOT
            </span>
          ) : isLowCapacity ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800/80">
              AVAILABLE {departure.remainingSlots}
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800/80">
              AVAILABLE {departure.remainingSlots}
            </span>
          )}
        </div>

        {/* Action Button */}
        {isWaitlistOnly ? (
          <button
            type="button"
            onClick={() => onJoinWaitlist(departure)}
            className="px-4 py-2 rounded-lg text-xs font-mono font-bold bg-sky-600 hover:bg-sky-700 text-white dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950 transition duration-150 shadow-sm cursor-pointer text-center"
          >
            JOIN WAITLIST
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onBook(departure)}
            className="px-4 py-2 rounded-lg text-xs font-mono font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition duration-150 shadow-sm cursor-pointer text-center"
          >
            BOOK CONTAINER
          </button>
        )}
      </div>
    </div>
  );
};
