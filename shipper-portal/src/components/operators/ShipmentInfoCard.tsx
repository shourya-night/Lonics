import { Package, MapPin, ArrowRight, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';
import type { AssignedShipment } from '../../types/operator';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING_PICKUP:    { label: 'Pending Pickup',    color: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600' },
  ARRIVED_AT_PICKUP: { label: 'Arrived at Pickup', color: 'bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700' },
  PICKUP_CONFIRMED:  { label: 'Pickup Confirmed',  color: 'bg-sky-100 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400 border-sky-300 dark:border-sky-700' },
  IN_TRANSIT:        { label: 'In Transit',         color: 'bg-primary/10 dark:bg-primary/20 text-primary border-primary/30' },
  ARRIVED_AT_DROP:   { label: 'Arrived at Drop',   color: 'bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-400 border-violet-300 dark:border-violet-700' },
  DELIVERY_CONFIRMED:{ label: 'Delivered ✓',        color: 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700' },
};

interface ShipmentInfoCardProps {
  shipment: AssignedShipment;
}

export default function ShipmentInfoCard({ shipment }: ShipmentInfoCardProps) {
  const statusInfo = STATUS_LABELS[shipment.status] ?? STATUS_LABELS['PENDING_PICKUP'];
  const sealVerified = shipment.seal.verified;

  return (
    <div className="bg-card border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap justify-between items-start gap-2">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Shipment ID</p>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground font-mono">{shipment.shipmentId}</h2>
        </div>
        <span className={`px-2.5 py-1 rounded-full border text-[10px] font-mono font-bold uppercase tracking-wide ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
      </div>

      {/* Cargo */}
      <div className="flex items-start gap-3 bg-muted/30 rounded-xl p-3.5 border border-slate-200 dark:border-zinc-800">
        <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
          <Package className="h-4 w-4 text-primary" />
        </div>
        <div className="space-y-0.5 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-snug">{shipment.cargo.description}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-mono text-muted-foreground">
            <span>{shipment.cargo.pallets} pallets</span>
            <span>·</span>
            <span>{shipment.cargo.weightTonnes}t</span>
            <span>·</span>
            <span>{shipment.cargo.containerType}</span>
            {shipment.cargo.commodity && (
              <>
                <span>·</span>
                <span>{shipment.cargo.commodity}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Route */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-sky-500 flex-shrink-0" />
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Origin</p>
          </div>
          <p className="text-sm font-semibold text-foreground leading-snug">{shipment.origin.name}</p>
          <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{shipment.origin.scheduledTime}</span>
            <span className="text-muted-foreground/60">({shipment.origin.window[0]}–{shipment.origin.window[1]})</span>
          </div>
        </div>

        <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />

        <div className="space-y-0.5 text-right">
          <div className="flex items-center justify-end gap-1.5">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Destination</p>
            <MapPin className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
          </div>
          <p className="text-sm font-semibold text-foreground leading-snug">{shipment.destination.name}</p>
          <div className="flex items-center justify-end gap-1 text-[11px] font-mono text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>ETA {shipment.destination.scheduledTime}</span>
          </div>
        </div>
      </div>

      {/* Seal */}
      <div className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 border ${
        sealVerified
          ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50'
          : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/50'
      }`}>
        <div className="flex items-center gap-2.5">
          {sealVerified
            ? <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            : <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          }
          <div>
            <p className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
              sealVerified ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
            }`}>
              Seal {sealVerified ? 'Verified' : 'Unverified'}
            </p>
            <p className="text-xs font-mono text-foreground font-semibold">{shipment.seal.id}</p>
          </div>
        </div>
        {shipment.seal.verifiedAt && (
          <p className="text-[10px] font-mono text-muted-foreground text-right">
            {new Date(shipment.seal.verifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>

      {/* Truck + Driver */}
      <div className="flex flex-wrap justify-between items-center gap-2 text-[11px] font-mono text-muted-foreground border-t border-slate-200 dark:border-zinc-800 pt-3">
        <span>Truck: <span className="font-bold text-foreground">{shipment.truckId}</span></span>
        <span>Driver: <span className="font-bold text-foreground">{shipment.driverName}</span></span>
        {shipment.consolidationLegs && (
          <span>Legs: <span className="text-foreground">{shipment.consolidationLegs.join(', ')}</span></span>
        )}
      </div>
    </div>
  );
}
