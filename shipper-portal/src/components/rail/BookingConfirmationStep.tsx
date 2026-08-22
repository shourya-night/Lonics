import React, { useState } from 'react';
import type { RailDeparture } from '../../types/rail-booking';
import { ArrowLeft, ArrowRight, Train, CheckCircle2, Users, ShieldCheck } from 'lucide-react';

interface BookingConfirmationStepProps {
  departure: RailDeparture;
  isWaitlist: boolean;
  onConfirm: (cargoDescription: string, consigneeName: string) => void;
  onBack: () => void;
}

export const BookingConfirmationStep: React.FC<BookingConfirmationStepProps> = ({
  departure,
  isWaitlist,
  onConfirm,
  onBack,
}) => {
  const [consigneeName, setConsigneeName] = useState('Bharat Freight & Assemblies Pvt Ltd');
  const [cargoDescription, setCargoDescription] = useState('Consolidated Industrial Cargo & Machinery Spares');

  const nextWaitlistPos = departure.waitlistCount + 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(cargoDescription, consigneeName);
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to available departures</span>
      </button>

      {/* Confirmation Header */}
      <div className="bg-muted/40 border border-border rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          {isWaitlist ? (
            <span className="p-2 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800">
              <Users className="h-5 w-5" />
            </span>
          ) : (
            <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
              <CheckCircle2 className="h-5 w-5" />
            </span>
          )}
          <div>
            <h3 className="text-base font-bold text-foreground">
              {isWaitlist ? 'Join Waitlist Queue' : 'Confirm Rail Container Reservation'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isWaitlist
                ? `You will be allocated waitlist position WL0${nextWaitlistPos}`
                : `Reserving 1 slot on Container ${departure.containerCode}`}
            </p>
          </div>
        </div>

        {/* Departure Summary Card */}
        <div className="bg-card border border-border rounded-lg p-3.5 text-xs font-mono space-y-2.5">
          <div className="flex justify-between items-center text-foreground font-bold border-b border-border/60 pb-2">
            <span className="flex items-center gap-1.5">
              <Train className="h-3.5 w-3.5 text-primary" />
              {departure.origin} → {departure.destination}
            </span>
            <span className="text-primary">{departure.date} · {departure.time}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-muted-foreground">
            <div>
              <span className="block text-[10px] uppercase">Container</span>
              <span className="font-bold text-foreground">{departure.containerCode}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase">Rake</span>
              <span className="font-bold text-foreground">{departure.rakeNumber}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase">Type</span>
              <span className="font-bold text-foreground">{departure.containerType}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-xs font-mono font-bold text-foreground">
            Consignee Name / Receiving Entity
          </label>
          <input
            type="text"
            required
            value={consigneeName}
            onChange={(e) => setConsigneeName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg text-xs font-mono bg-card text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Enter Consignee Business Name"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-mono font-bold text-foreground">
            Consignment Cargo Description
          </label>
          <input
            type="text"
            required
            value={cargoDescription}
            onChange={(e) => setCargoDescription(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-lg text-xs font-mono bg-card text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="e.g. Precision Engineering Parts, Textiles, etc."
          />
        </div>

        {/* Operational Notice */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border text-[11px] text-muted-foreground font-mono">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <span>
            {isWaitlist
              ? `Waitlist queue moves automatically if a booked shipper cancels before gate cutoff (${departure.cutoffTime}).`
              : `Allotted container slot will be held immediately in your session. Cutoff is ${departure.cutoffTime}.`}
          </span>
        </div>

        {/* Action CTAs */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-lg text-xs font-mono border border-border bg-card text-foreground hover:bg-muted transition cursor-pointer"
          >
            BACK
          </button>

          {isWaitlist ? (
            <button
              type="submit"
              className="px-5 py-2 rounded-lg text-xs font-mono font-bold bg-sky-600 hover:bg-sky-700 text-white dark:bg-sky-500 dark:hover:bg-sky-400 dark:text-slate-950 transition cursor-pointer flex items-center gap-1.5"
            >
              <span>CONFIRM WAITLIST</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              className="px-5 py-2 rounded-lg text-xs font-mono font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition cursor-pointer flex items-center gap-1.5"
            >
              <span>CONFIRM BOOKING</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
