import React, { useState } from 'react';
import type { RailReservation } from '../../types/rail-booking';
import { ArrowRight, Train, CheckCircle2, Users, Ban, Trash2 } from 'lucide-react';

interface MyReservationsTabProps {
  reservations: RailReservation[];
  onCancelReservation: (reservationId: string) => void;
  onBrowseDepartures: () => void;
}

export const MyReservationsTab: React.FC<MyReservationsTabProps> = ({
  reservations,
  onCancelReservation,
  onBrowseDepartures,
}) => {
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleConfirmCancel = (id: string) => {
    onCancelReservation(id);
    setCancellingId(null);
  };

  if (reservations.length === 0) {
    return (
      <div className="text-center py-12 space-y-4 bg-muted/20 border border-border rounded-xl p-6">
        <div className="inline-flex p-3 rounded-full bg-muted border border-border">
          <Train className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-foreground">No Reservations Found</h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            You have not booked any container slots or joined any waitlists in this session.
          </p>
        </div>
        <button
          type="button"
          onClick={onBrowseDepartures}
          className="px-4 py-2 rounded-lg text-xs font-mono font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition cursor-pointer"
        >
          BROWSE UPCOMING DEPARTURES
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      {reservations.map((res) => {
        const isCancelled = res.status === 'CANCELLED';
        const isWaitlist = res.status.startsWith('WL');
        const isConfirmingCancel = cancellingId === res.id;

        return (
          <div
            key={res.id}
            className={`bg-card text-card-foreground border rounded-xl p-4 sm:p-5 transition space-y-3.5 shadow-sm ${
              isCancelled ? 'border-border/50 opacity-70 bg-muted/20' : 'border-border hover:border-primary/40'
            }`}
          >
            {/* Header: Reference + Status Pill */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold tracking-wider text-foreground">
                  {res.bookingReference}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  Booked: {new Date(res.bookedAt).toLocaleDateString()} {new Date(res.bookedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div>
                {isCancelled ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-900/50">
                    <Ban className="h-3 w-3" />
                    CANCELLED
                  </span>
                ) : isWaitlist ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                    <Users className="h-3 w-3" />
                    {res.status} · Position {res.waitlistPosition}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 className="h-3 w-3" />
                    CONFIRMED · SLOT {res.slotNumber || 1}
                  </span>
                )}
              </div>
            </div>

            {/* Route & Schedule */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <span>{res.departure.origin}</span>
                <ArrowRight className="h-4 w-4 text-primary shrink-0" />
                <span>{res.departure.destination}</span>
              </div>
              <div className="text-xs font-mono text-muted-foreground flex flex-wrap gap-x-4">
                <span>Departure: <span className="text-foreground font-semibold">{res.departure.date} · {res.departure.time}</span></span>
                <span>Rake: <span className="text-foreground">{res.departure.rakeNumber}</span></span>
              </div>
            </div>

            {/* Metadata Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] font-mono bg-muted/40 p-2.5 rounded-lg border border-border/80">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block">Container</span>
                <span className="font-bold text-foreground">{res.departure.containerCode}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block">Type</span>
                <span className="font-bold text-foreground">{res.departure.containerType}</span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[10px] text-muted-foreground uppercase block">Consignee</span>
                <span className="font-semibold text-foreground truncate block">{res.consigneeName}</span>
              </div>
            </div>

            {/* Footer / Actions */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/60">
              <div className="text-[11px] font-mono text-muted-foreground">
                {isCancelled && res.cancelledAt ? (
                  <span>Cancelled at {new Date(res.cancelledAt).toLocaleTimeString()} • Slot released back to pool</span>
                ) : (
                  <span>Cut-off: {res.departure.cutoffTime}</span>
                )}
              </div>

              {!isCancelled && (
                <div>
                  {isConfirmingCancel ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-rose-600 dark:text-rose-400 font-semibold">
                        Confirm cancellation?
                      </span>
                      <button
                        type="button"
                        onClick={() => handleConfirmCancel(res.id)}
                        className="px-2.5 py-1 rounded bg-rose-600 text-white hover:bg-rose-700 text-xs font-mono font-bold transition cursor-pointer"
                      >
                        Yes, Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => setCancellingId(null)}
                        className="px-2.5 py-1 rounded border border-border bg-card text-foreground hover:bg-muted text-xs font-mono transition cursor-pointer"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCancellingId(res.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{isWaitlist ? 'CANCEL WAITLIST' : 'CANCEL RESERVATION'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
