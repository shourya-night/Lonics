import { CheckCircle2, History } from 'lucide-react';
import type { ShipmentHistoryItem } from '../../data/previewData';

interface ShipmentHistorySectionProps {
  shipments: ShipmentHistoryItem[];
  totalCompletedCount?: number;
}

export default function ShipmentHistorySection({
  shipments,
  totalCompletedCount = 12,
}: ShipmentHistorySectionProps) {
  // Show first 3 for rapid glanceability
  const displayShipments = shipments.slice(0, 3);

  return (
    <div className="h-full flex flex-col justify-between bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm text-card-foreground">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <History className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] sm:text-xs font-mono font-semibold tracking-wider text-muted-foreground uppercase">
            Shipment History
          </span>
        </div>
        <span className="text-[10px] sm:text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
          {totalCompletedCount} COMPLETED
        </span>
      </div>

      {/* Glanceable Rows */}
      <div className="space-y-1.5 sm:space-y-2 my-2">
        {displayShipments.map((shipment) => (
          <div
            key={shipment.id}
            className="flex items-center justify-between py-1.5 px-2.5 rounded bg-muted/40 border border-border/70 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-xs sm:text-sm font-semibold text-foreground truncate">
                {shipment.origin} <span className="text-primary font-normal">→</span> {shipment.destination}
              </span>
              <span className="hidden sm:inline-block text-[10px] font-mono text-muted-foreground">
                {shipment.tonnage} MT
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] sm:text-xs font-mono text-muted-foreground">
                {shipment.completionDate}
              </span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-label="Completed" />
            </div>
          </div>
        ))}
      </div>

      {/* Footer subtle telemetry */}
      <div className="flex items-center justify-between pt-1 text-[9px] sm:text-[10px] font-mono text-muted-foreground">
        <span>ALL CORRIDORS SETTLED</span>
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">100% ON-TIME</span>
      </div>
    </div>
  );
}
