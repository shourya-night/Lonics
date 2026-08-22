import React from 'react';
import type { RailReservation } from '../../types/rail-booking';
import { CheckCircle2, Users, ArrowRight, Copy, Check } from 'lucide-react';

interface BookingSuccessTicketProps {
  reservation: RailReservation;
  onViewReservations: () => void;
  onBookAnother: () => void;
}

export const BookingSuccessTicket: React.FC<BookingSuccessTicketProps> = ({
  reservation,
  onViewReservations,
  onBookAnother,
}) => {
  const [copied, setCopied] = React.useState(false);
  const isWaitlist = reservation.status.startsWith('WL');

  const handleCopy = () => {
    navigator.clipboard.writeText(reservation.bookingReference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5 animate-fadeIn py-2">
      {/* Top Banner */}
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 rounded-full bg-muted border border-border">
          {isWaitlist ? (
            <Users className="h-8 w-8 text-sky-600 dark:text-sky-400" />
          ) : (
            <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          )}
        </div>
        <h3 className="text-lg font-bold text-foreground">
          {isWaitlist ? 'Waitlist Ticket Issued' : 'Container Slot Confirmed!'}
        </h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          {isWaitlist
            ? `Your request is recorded at waitlist position ${reservation.status}. You will be alerted if capacity opens.`
            : `Your container allocation has been locked for departure on ${reservation.departure.date}.`}
        </p>
      </div>

      {/* Ticket Surface */}
      <div className="bg-card text-card-foreground border-2 border-dashed border-border rounded-xl p-5 space-y-4 shadow-md">
        {/* Ticket Header: Reference + Status Pill */}
        <div className="flex flex-wrap justify-between items-center gap-2 border-b border-border pb-3">
          <div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase">Booking Reference</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-sm font-bold text-foreground tracking-wider">
                {reservation.bookingReference}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="p-1 rounded hover:bg-muted text-muted-foreground transition cursor-pointer"
                title="Copy reference"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div>
            {isWaitlist ? (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-mono font-bold bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
                <Users className="h-3.5 w-3.5" />
                {reservation.status} (Position {reservation.waitlistPosition})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-mono font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" />
                CONFIRMED
              </span>
            )}
          </div>
        </div>

        {/* Route Details */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <span>{reservation.departure.origin}</span>
            <ArrowRight className="h-4 w-4 text-primary shrink-0" />
            <span>{reservation.departure.destination}</span>
          </div>
          <div className="text-xs font-mono text-muted-foreground">
            Departure: <span className="text-foreground font-semibold">{reservation.departure.date} · {reservation.departure.time}</span>
          </div>
        </div>

        {/* Grid Meta */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono bg-muted/30 p-3 rounded-lg border border-border">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase block">Container</span>
            <span className="font-bold text-foreground">{reservation.departure.containerCode}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase block">Rake ID</span>
            <span className="font-bold text-foreground">{reservation.departure.rakeNumber}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase block">Container Type</span>
            <span className="font-bold text-foreground">{reservation.departure.containerType}</span>
          </div>
          <div className="col-span-2 sm:col-span-3 border-t border-border/50 pt-2 mt-1">
            <span className="text-[10px] text-muted-foreground uppercase block">Consignee</span>
            <span className="font-semibold text-foreground truncate block">{reservation.consigneeName}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onBookAnother}
          className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-mono border border-border bg-card text-foreground hover:bg-muted transition cursor-pointer text-center"
        >
          BOOK ANOTHER SLOT
        </button>

        <button
          type="button"
          onClick={onViewReservations}
          className="w-full sm:w-auto px-5 py-2 rounded-lg text-xs font-mono font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition cursor-pointer text-center flex items-center justify-center gap-1.5"
        >
          <span>VIEW IN MY RESERVATIONS</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
