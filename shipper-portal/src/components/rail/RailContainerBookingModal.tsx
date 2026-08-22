import React, { useState } from 'react';
import type { RailDeparture, RailReservation, ModalTab } from '../../types/rail-booking';
import { useRailBookingSession } from '../../hooks/useRailBookingSession';
import { DepartureCard } from './DepartureCard';
import { BookingConfirmationStep } from './BookingConfirmationStep';
import { BookingSuccessTicket } from './BookingSuccessTicket';
import { MyReservationsTab } from './MyReservationsTab';
import { X, Train, Layers, Bookmark, Info, Sun, Moon } from 'lucide-react';

interface RailContainerBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const RailContainerBookingModal: React.FC<RailContainerBookingModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onToggleTheme,
}) => {
  const { departures, reservations, bookSlot, joinWaitlist, cancelReservation } = useRailBookingSession();

  const [activeTab, setActiveTab] = useState<ModalTab>('departures');
  const [selectedDeparture, setSelectedDeparture] = useState<RailDeparture | null>(null);
  const [isWaitlistMode, setIsWaitlistMode] = useState(false);
  const [lastCreatedReservation, setLastCreatedReservation] = useState<RailReservation | null>(null);

  if (!isOpen) return null;

  // Active reservations count for badge (excluding cancelled)
  const activeReservationsCount = reservations.filter((r) => r.status !== 'CANCELLED').length;

  const handleStartBooking = (departure: RailDeparture) => {
    setSelectedDeparture(departure);
    setIsWaitlistMode(false);
    setLastCreatedReservation(null);
  };

  const handleStartWaitlist = (departure: RailDeparture) => {
    setSelectedDeparture(departure);
    setIsWaitlistMode(true);
    setLastCreatedReservation(null);
  };

  const handleConfirmReservation = (cargoDescription: string, consigneeName: string) => {
    if (!selectedDeparture) return;

    if (isWaitlistMode) {
      const res = joinWaitlist(selectedDeparture.id, cargoDescription, consigneeName);
      setLastCreatedReservation(res);
    } else {
      const res = bookSlot(selectedDeparture.id, cargoDescription, consigneeName);
      setLastCreatedReservation(res);
    }
  };

  const handleBackToDepartures = () => {
    setSelectedDeparture(null);
    setLastCreatedReservation(null);
    setIsWaitlistMode(false);
  };

  const handleViewReservations = () => {
    setSelectedDeparture(null);
    setLastCreatedReservation(null);
    setActiveTab('reservations');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 dark:bg-black/70 backdrop-blur-[2px] animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rail-booking-title"
    >
      {/* Modal Container */}
      <div className="bg-card text-card-foreground border border-border rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden transition-colors duration-200">
        
        {/* Modal Header */}
        <header className="p-4 sm:p-5 border-b border-border flex items-start justify-between gap-3 bg-muted/20">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0 mt-0.5">
              <Train className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="rail-booking-title" className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                  Rail Container Availability & Reservation
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Info className="h-3 w-3 text-primary shrink-0" />
                <span>Simulated Indian Freight Corridor departures • Real-time session state</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Quick theme toggle in modal header if available */}
            {onToggleTheme && currentTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className="p-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted transition duration-150 cursor-pointer"
                title={`Switch to ${currentTheme === 'light' ? 'Dark' : 'Light'} mode`}
              >
                {currentTheme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-amber-400" />}
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted transition duration-150 cursor-pointer"
              title="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Tab Navigation (only show when not in step sub-views) */}
        {!selectedDeparture && !lastCreatedReservation && (
          <div className="px-4 sm:px-5 pt-3 border-b border-border flex gap-2 bg-muted/10">
            <button
              type="button"
              onClick={() => setActiveTab('departures')}
              className={`pb-3 px-3 text-xs font-mono font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'departures'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Available Departures</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('reservations')}
              className={`pb-3 px-3 text-xs font-mono font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'reservations'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Bookmark className="h-3.5 w-3.5" />
              <span>My Reservations</span>
              {activeReservationsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-primary/20 text-primary border border-primary/30">
                  {activeReservationsCount}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Modal Scrollable Content Area */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* Sub-view 1: Confirmation Ticket */}
          {lastCreatedReservation ? (
            <BookingSuccessTicket
              reservation={lastCreatedReservation}
              onViewReservations={handleViewReservations}
              onBookAnother={handleBackToDepartures}
            />
          ) : selectedDeparture ? (
            /* Sub-view 2: Booking / Waitlist Confirmation Step */
            <BookingConfirmationStep
              departure={selectedDeparture}
              isWaitlist={isWaitlistMode}
              onConfirm={handleConfirmReservation}
              onBack={handleBackToDepartures}
            />
          ) : activeTab === 'departures' ? (
            /* Sub-view 3: List of Upcoming Departures */
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs font-mono text-muted-foreground px-0.5">
                <span>Showing {departures.length} scheduled rakes</span>
                <span className="text-[11px]">Instant session capacity sync</span>
              </div>

              <div className="space-y-3.5">
                {departures.map((departure) => (
                  <DepartureCard
                    key={departure.id}
                    departure={departure}
                    onBook={handleStartBooking}
                    onJoinWaitlist={handleStartWaitlist}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* Sub-view 4: My Reservations */
            <MyReservationsTab
              reservations={reservations}
              onCancelReservation={cancelReservation}
              onBrowseDepartures={() => setActiveTab('departures')}
            />
          )}
        </div>

        {/* Modal Footer */}
        <footer className="px-4 sm:px-5 py-3 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-muted-foreground">
          <div>
            Lonics Multimodal Linehaul • Single-Window Booking
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-md border border-border bg-card text-foreground hover:bg-muted text-xs font-mono transition cursor-pointer"
          >
            Close Deck
          </button>
        </footer>

      </div>
    </div>
  );
};

export default RailContainerBookingModal;
