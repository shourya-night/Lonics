import { Navigation } from 'lucide-react';
import type { CurrentShipmentItem } from '../../data/previewData';

interface CurrentShipmentsSectionProps {
  shipments: CurrentShipmentItem[];
}

export default function CurrentShipmentsSection({ shipments }: CurrentShipmentsSectionProps) {
  // Show top 2 active shipments for fast glanceability
  const displayShipments = shipments.slice(0, 2);

  return (
    <div className="h-full flex flex-col justify-between bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm text-card-foreground">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Navigation className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] sm:text-xs font-mono font-semibold tracking-wider text-muted-foreground uppercase">
            Current Shipments
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] sm:text-[11px] font-mono font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>{shipments.length} ACTIVE</span>
        </div>
      </div>

      {/* Glanceable Active Shipments with Progress Bars */}
      <div className="space-y-2.5 my-2">
        {displayShipments.map((shipment) => {
          const isTerminal = shipment.statusType === 'terminal';

          return (
            <div
              key={shipment.id}
              className="py-1.5 px-2.5 rounded bg-muted/40 border border-border/70 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs sm:text-sm font-semibold text-foreground">
                  {shipment.origin} <span className="text-primary font-normal">→</span> {shipment.destination}
                </span>
                <span
                  className={`text-[10px] sm:text-[11px] font-mono font-semibold ${
                    isTerminal ? 'text-amber-600 dark:text-amber-400' : 'text-primary'
                  }`}
                >
                  {shipment.progressPercent}% · {isTerminal ? 'AT TERMINAL' : `ETA ${shipment.eta}`}
                </span>
              </div>

              {/* Progress Track using Theme Tokens */}
              <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isTerminal ? 'bg-amber-500' : 'bg-primary'
                  }`}
                  style={{ width: `${shipment.progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground">
                <span>{shipment.loadCode}</span>
                <span>{shipment.currentWaypoint}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer subtle telemetry */}
      <div className="flex items-center justify-between pt-1 text-[9px] sm:text-[10px] font-mono text-muted-foreground">
        <span>FOIS / GPS RAKE TELEMETRY</span>
        <span className="text-primary font-medium">LIVE SYNC</span>
      </div>
    </div>
  );
}
