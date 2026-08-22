import { useState, useMemo, memo } from 'react';
import { Camera, Plus, Trash2, ShieldCheck, HelpCircle, Loader2, IndianRupee, ChevronLeft, ChevronRight, Train } from 'lucide-react';
import { bookFreight } from '../utils/api';
import type { BookingResponse, BookingRequest } from '../utils/api';
import AICargoScanner from './AICargoScanner';

export interface PackageRow {
  id: string;
  type: 'Carton' | 'Pallet' | 'Drum' | 'Bale';
  length: number;
  width: number;
  height: number;
  quantity: number;
  weight: number;
}

interface QuotingConsoleProps {
  onBookingCreated?: (booking: BookingResponse) => void;
}

function QuotingConsole({ onBookingCreated }: QuotingConsoleProps) {
  const [rows, setRows] = useState<PackageRow[]>([
    { id: '1', type: 'Carton', length: 50, width: 40, height: 30, quantity: 5, weight: 15 },
  ]);

  const [activeMobileStep, setActiveMobileStep] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [showScanTooltip, setShowScanTooltip] = useState(false);
  const [railLockEnabled, setRailLockEnabled] = useState(false);

  const [isBooking, setIsBooking] = useState(false);
  const [bookingResult, setBookingResult] = useState<BookingResponse | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Add package row
  const addRow = () => {
    const newRow: PackageRow = {
      id: Math.random().toString(36).substring(2, 9),
      type: 'Carton',
      length: 100,
      width: 80,
      height: 120,
      quantity: 1,
      weight: 50,
    };
    setRows((prev) => [...prev, newRow]);
    setBookingResult(null); // Clear previous booking result as inputs changed
  };

  // Remove row
  const removeRow = (id: string) => {
    if (rows.length === 1) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
    setBookingResult(null);
  };

  // Update cell
  const updateCell = <K extends keyof PackageRow>(
    id: string,
    key: K,
    value: PackageRow[K]
  ) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [key]: value } : r))
    );
    setBookingResult(null);
  };

  // Real CV Cargo Scan callback
  const handleScanComplete = (metrics: {
    type: 'Carton' | 'Pallet' | 'Drum' | 'Bale';
    length: number;
    width: number;
    height: number;
    label: string;
  }) => {
    const newRow: PackageRow = {
      id: 'scan-' + Math.random().toString(36).substring(2, 9),
      type: metrics.type,
      length: metrics.length,
      width: metrics.width,
      height: metrics.height,
      quantity: 1,
      weight: Math.max(1, Math.round(metrics.length * metrics.width * metrics.height * 0.00015)),
    };
    setRows((prev) => [...prev, newRow]);
    setIsScanning(false);
    setShowScanTooltip(true);
    setScanStatus(`AI Scan complete: Detected a ${metrics.label} (${metrics.length}x${metrics.width}x${metrics.height} cm).`);
  };

  const startAIScan = () => {
    setIsScanning(true);
    setShowScanTooltip(false);
    setBookingResult(null);
  };

  // Estimate pricing spreads locally to match backend multipliers
  const localEstimates = useMemo(() => {
    let totalActualMass = 0;
    let totalVolumetricWeight = 0;
    let totalCbm = 0;

    rows.forEach((r) => {
      const vol = r.length * r.width * r.height * r.quantity;
      totalCbm += vol / 1000000.0;
      totalVolumetricWeight += vol / 5000.0;
      totalActualMass += r.weight * r.quantity;
    });

    const isVolumetric = totalVolumetricWeight > totalActualMass;
    const chargeableWeight = Math.max(totalActualMass, totalVolumetricWeight);

    // Backend pricing formulas:
    // Road shadow = weight * 14.5
    // Rail base = weight * 9.0
    const roadPrice = chargeableWeight * 14.5;
    const railBasePrice = chargeableWeight * 9.0;
    
    // Contigency buffer estimate (assuming ~5% capacity occupied)
    const contingency = railBasePrice * 0.05 * 0.15;
    let railPrice = railBasePrice + contingency;

    if (railLockEnabled) {
      railPrice = railPrice * 1.12;
    }

    return {
      totalActualMass: Math.round(totalActualMass),
      totalVolumetricWeight: Math.round(totalVolumetricWeight),
      chargeableWeight: Math.round(chargeableWeight),
      totalCbm: parseFloat(totalCbm.toFixed(3)),
      isVolumetric,
      roadPrice: parseFloat(roadPrice.toFixed(2)),
      railPrice: parseFloat(railPrice.toFixed(2)),
    };
  }, [rows, railLockEnabled]);

  // Execute actual booking call to the backend
  const handleConfirmBooking = async () => {
    setIsBooking(true);
    setBookingError(null);

    const payload: BookingRequest = {
      shipper_id: 'SHIP-DFC-001',
      origin: 'Mumbai Port DFC Gate-1',
      destination: 'Delhi ICD Terminal-3',
      rail_lock_upgrade: railLockEnabled,
      cargo_items: rows.map((r) => ({
        package_type: r.type,
        length: r.length,
        width: r.width,
        height: r.height,
        quantity: r.quantity,
        weight_kg: r.weight,
      })),
    };

    try {
      const res = await bookFreight(payload);
      setBookingResult(res);
      if (onBookingCreated) {
        onBookingCreated(res);
      }
    } catch (err: any) {
      setBookingError(err.message || 'Error occurred connecting to core-engine.');
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <div className="bg-card/80 border border-slate-200 dark:border-zinc-800 backdrop-blur-md rounded-xl p-4 md:p-5 shadow-2xl flex flex-col lg:flex-row gap-6">
      {/* LEFT: Multi-row Input Grid */}
      <div className="flex-1 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-200 dark:border-zinc-800 pb-3">
          <div>
            <h2 className="font-bold text-lg text-foreground">Single-Window Quoting Console</h2>
            <p className="text-xs text-muted-foreground">Specify package dimensions, weight, and quantities</p>
          </div>
          
          <button
            type="button"
            disabled={isScanning}
            onClick={startAIScan}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition duration-200 border ${
              isScanning
                ? 'bg-muted border-slate-200 dark:border-zinc-800 text-muted-foreground cursor-not-allowed'
                : 'bg-primary border-primary hover:bg-primary/80 text-background shadow-lg shadow-primary/10 cursor-pointer'
            }`}
          >
            {isScanning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            AI Cargo Scan
          </button>
        </div>

        {isScanning && (
          <AICargoScanner
            onScanComplete={handleScanComplete}
            onClose={() => setIsScanning(false)}
          />
        )}

        {showScanTooltip && !isScanning && (
          <div className="bg-primary/10 border border-primary/20 p-3 rounded-lg flex justify-between items-center animate-fade-in text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary animate-ping"></span>
              <p className="text-primary/80 font-medium animate-pulse">
                {scanStatus || 'AI Scan complete. Density dimensions calculated successfully.'}
              </p>
            </div>
            <div className="relative group">
              <span className="cursor-help px-2 py-0.5 rounded bg-primary/20 text-primary font-mono text-[10px] border border-primary/30 flex items-center gap-1">
                <HelpCircle className="h-3 w-3" /> ±8% Accuracy
              </span>
              <div className="absolute right-0 bottom-full mb-2 w-64 p-2 bg-card border border-slate-200 dark:border-zinc-800 text-[10px] rounded text-muted-foreground leading-normal hidden group-hover:block z-50 shadow-xl">
                Density calculated using MobileNetV3 voxel depth estimations. Values carry a ±8% accuracy margin based on ambient lighting criteria.
              </div>
            </div>
          </div>
        )}

        {/* Mobile-first Swipable Stepper Layout (visible under 768px / md breakpoint) */}
        <div className="block md:hidden space-y-4">
          <div className="bg-background/60 border border-border/40 p-4 rounded-xl space-y-3">
            <div className="flex justify-between items-center border-b border-border/20 pb-2">
              <span className="font-mono text-xs font-bold text-muted-foreground uppercase">
                Cargo Item {Math.min(activeMobileStep + 1, rows.length)} of {rows.length}
              </span>
              <button
                type="button"
                disabled={rows.length === 1}
                onClick={() => {
                  const id = rows[activeMobileStep]?.id;
                  if (id) {
                    removeRow(id);
                    setActiveMobileStep((prev) => Math.max(0, prev - 1));
                  }
                }}
                className={`h-9 px-3 rounded-lg text-xs font-semibold transition duration-150 flex items-center gap-1 cursor-pointer ${
                  rows.length === 1
                    ? 'text-muted-foreground bg-muted/40 cursor-not-allowed border border-border/40'
                    : 'text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30'
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            </div>

            {rows[activeMobileStep] && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-muted-foreground">Package Type</label>
                  <select
                    value={rows[activeMobileStep].type}
                    onChange={(e) => updateCell(rows[activeMobileStep].id, 'type', e.target.value as any)}
                    className="h-12 w-full bg-background border border-border/80 rounded-lg px-3 text-sm text-foreground outline-none focus:border-primary transition"
                  >
                    <option value="Carton">Carton</option>
                    <option value="Pallet">Pallet</option>
                    <option value="Drum">Drum</option>
                    <option value="Bale">Bale</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase text-muted-foreground">Length (cm)</label>
                    <input
                      type="number"
                      value={rows[activeMobileStep].length}
                      onChange={(e) => updateCell(rows[activeMobileStep].id, 'length', Math.max(1, parseInt(e.target.value) || 0))}
                      className="h-12 w-full bg-background border border-border/80 rounded-lg px-3 text-sm text-foreground outline-none focus:border-primary transition font-mono animate-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase text-muted-foreground">Width (cm)</label>
                    <input
                      type="number"
                      value={rows[activeMobileStep].width}
                      onChange={(e) => updateCell(rows[activeMobileStep].id, 'width', Math.max(1, parseInt(e.target.value) || 0))}
                      className="h-12 w-full bg-background border border-border/80 rounded-lg px-3 text-sm text-foreground outline-none focus:border-primary transition font-mono animate-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase text-muted-foreground">Height (cm)</label>
                    <input
                      type="number"
                      value={rows[activeMobileStep].height}
                      onChange={(e) => updateCell(rows[activeMobileStep].id, 'height', Math.max(1, parseInt(e.target.value) || 0))}
                      className="h-12 w-full bg-background border border-border/80 rounded-lg px-3 text-sm text-foreground outline-none focus:border-primary transition font-mono animate-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase text-muted-foreground">Weight (KG)</label>
                    <input
                      type="number"
                      value={rows[activeMobileStep].weight}
                      onChange={(e) => updateCell(rows[activeMobileStep].id, 'weight', Math.max(1, parseInt(e.target.value) || 0))}
                      className="h-12 w-full bg-background border border-border/80 rounded-lg px-3 text-sm text-foreground outline-none focus:border-primary transition font-mono animate-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-muted-foreground">Quantity</label>
                  <input
                    type="number"
                    value={rows[activeMobileStep].quantity}
                    onChange={(e) => updateCell(rows[activeMobileStep].id, 'quantity', Math.max(1, parseInt(e.target.value) || 0))}
                    className="h-12 w-full bg-background border border-border/80 rounded-lg px-3 text-sm text-primary font-bold outline-none focus:border-primary transition font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={activeMobileStep === 0}
              onClick={() => setActiveMobileStep((p) => Math.max(0, p - 1))}
              className="h-12 flex-1 bg-card border border-slate-200 dark:border-zinc-800 text-foreground hover:bg-muted font-bold rounded-lg text-xs transition duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
            >
              <ChevronLeft className="h-4 w-4 shrink-0" />
              <span>Previous</span>
            </button>
            <button
              type="button"
              disabled={activeMobileStep === rows.length - 1}
              onClick={() => setActiveMobileStep((p) => Math.min(rows.length - 1, p + 1))}
              className="h-12 flex-1 bg-card border border-slate-200 dark:border-zinc-800 text-foreground hover:bg-muted font-bold rounded-lg text-xs transition duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </button>
          </div>
        </div>

        {/* Multi-Row input Grid Table (visible on desktop) */}
        <div className="hidden md:block overflow-x-auto rounded-lg border border-border/40 bg-background/20">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground border-b border-border/40 font-mono uppercase tracking-wider text-[10px]">
                <th className="p-3">Type</th>
                <th className="p-3">Length (cm)</th>
                <th className="p-3">Width (cm)</th>
                <th className="p-3">Height (cm)</th>
                <th className="p-3">Qty</th>
                <th className="p-3">Weight (KG)</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/20 transition duration-150">
                  <td className="p-2">
                    <select
                      value={row.type}
                      onChange={(e) => updateCell(row.id, 'type', e.target.value as any)}
                      className="bg-background border border-border/80 rounded px-2 py-1 text-foreground outline-none focus:border-primary w-full"
                    >
                      <option value="Carton">Carton</option>
                      <option value="Pallet">Pallet</option>
                      <option value="Drum">Drum</option>
                      <option value="Bale">Bale</option>
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={row.length}
                      onChange={(e) => updateCell(row.id, 'length', Math.max(1, parseInt(e.target.value) || 0))}
                      className="bg-background border border-border/80 rounded px-2 py-1 text-foreground outline-none focus:border-primary w-full font-mono text-right"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={row.width}
                      onChange={(e) => updateCell(row.id, 'width', Math.max(1, parseInt(e.target.value) || 0))}
                      className="bg-background border border-border/80 rounded px-2 py-1 text-foreground outline-none focus:border-primary w-full font-mono text-right"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={row.height}
                      onChange={(e) => updateCell(row.id, 'height', Math.max(1, parseInt(e.target.value) || 0))}
                      className="bg-background border border-border/80 rounded px-2 py-1 text-foreground outline-none focus:border-primary w-full font-mono text-right"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={row.quantity}
                      onChange={(e) => updateCell(row.id, 'quantity', Math.max(1, parseInt(e.target.value) || 0))}
                      className="bg-background border border-border/80 rounded px-2 py-1 text-foreground outline-none focus:border-primary w-full font-mono text-right text-primary font-semibold"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      value={row.weight}
                      onChange={(e) => updateCell(row.id, 'weight', Math.max(1, parseInt(e.target.value) || 0))}
                      className="bg-background border border-border/80 rounded px-2 py-1 text-foreground outline-none focus:border-primary w-full font-mono text-right"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      disabled={rows.length === 1}
                      onClick={() => removeRow(row.id)}
                      className={`p-1.5 rounded transition duration-150 ${
                        rows.length === 1
                          ? 'text-muted-foreground cursor-not-allowed'
                          : 'text-rose-500 hover:bg-rose-500/15 hover:text-rose-600 cursor-pointer'
                      }`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={addRow}
          className="px-3 py-1.5 bg-card border border-border/85 hover:bg-muted hover:text-foreground rounded-lg text-xs font-semibold flex items-center gap-1 text-foreground transition duration-150 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" /> Add Cargo Row
        </button>

        {/* Booking success card (simplified card summary layout) */}
        {bookingResult && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                <ShieldCheck className="h-5 w-5" /> Booking Successfully Confirmed
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-850 text-emerald-700 dark:text-emerald-400">
                Assigned Rail Window: {bookingResult.assigned_window_id}
              </span>
            </div>

            <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider font-semibold">Total Final Cost</p>
                <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                  ₹{bookingResult.final_quote.toLocaleString()}
                </h3>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-mono">Booking ID</span>
                  <span className="text-foreground font-bold font-mono">{bookingResult.booking_id}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-mono">Chargeable Weight</span>
                  <span className="text-foreground font-mono">{bookingResult.chargeable_weight} kg</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-mono">CBM Occupied</span>
                  <span className="text-foreground font-mono">{bookingResult.total_cbm} CBM</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-mono">Pricing Breakdown</span>
                  <span className="text-muted-foreground text-[10px] block leading-tight mt-0.5">
                    Base: ₹{bookingResult.base_price} | Contingency: ₹{bookingResult.contingency_buffer}
                  </span>
                </div>
              </div>
            </div>

            {/* AI Prediction Model Insights from FastAPI */}
            {bookingResult.prediction_insights && (
              <div className="border-t border-emerald-500/20 pt-3 mt-3 bg-background/50 p-3 rounded-lg border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-mono font-bold text-primary flex items-center gap-1.5">
                    🤖 AI Modal Intelligence Insights
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                    {bookingResult.prediction_insights.recommendation}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 my-2 text-center text-xs font-mono">
                  <div className="bg-card p-1.5 rounded border border-border/60">
                    <span className="text-[9px] text-muted-foreground block">Rail Suitability</span>
                    <span className="font-bold text-emerald-500">{bookingResult.prediction_insights.rail_suitability}%</span>
                  </div>
                  <div className="bg-card p-1.5 rounded border border-border/60">
                    <span className="text-[9px] text-muted-foreground block">Network Pressure</span>
                    <span className="font-bold text-amber-500">{bookingResult.prediction_insights.network_pressure}/100</span>
                  </div>
                  <div className="bg-card p-1.5 rounded border border-border/60">
                    <span className="text-[9px] text-muted-foreground block">Demand Outlook</span>
                    <span className="font-bold text-primary">{bookingResult.prediction_insights.demand_outlook}</span>
                  </div>
                </div>
                {bookingResult.prediction_insights.reasons?.length > 0 && (
                  <ul className="text-[10px] text-muted-foreground space-y-1 mt-2 list-disc list-inside">
                    {bookingResult.prediction_insights.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {/* Booking error display */}
        {bookingError && (
          <div className="bg-destructive/10 border border-destructive/40 p-3 rounded-lg text-destructive text-xs">
            Error processing booking: {bookingError}. Make sure the FastAPI core-engine backend is running.
          </div>
        )}
      </div>

      {/* RIGHT: Sticky Dual-Brain Price Panel */}
      <div className="w-full lg:w-80 bg-card/80 border border-slate-200 dark:border-zinc-800 p-4 rounded-xl flex flex-col justify-between gap-5 self-stretch">
        <div className="space-y-4">
          <h3 className="font-bold text-sm text-foreground border-b border-slate-200 dark:border-zinc-800 pb-2">
            Dual-Brain Price Panel
          </h3>

          {/* Mass & Volumetric calculations */}
          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between text-muted-foreground">
              <span>Actual Weight:</span>
              <span className="text-foreground">{localEstimates.totalActualMass} kg</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Volumetric Weight:</span>
              <span className={`transition duration-200 ${localEstimates.isVolumetric ? 'text-primary font-bold' : 'text-foreground'}`}>
                {localEstimates.totalVolumetricWeight} kg
              </span>
            </div>
            <div className="border-t border-slate-200 dark:border-zinc-800 pt-2 flex justify-between items-center text-sm">
              <span className="font-sans text-foreground font-semibold">Chargeable Weight:</span>
              <span className="font-bold text-foreground bg-background px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-800">
                {bookingResult ? bookingResult.chargeable_weight : localEstimates.chargeableWeight} kg
              </span>
            </div>
            {localEstimates.isVolumetric && (
              <p className="text-[10px] text-primary font-sans leading-normal">
                * Charging on **Volumetric Weight** because it exceeds actual mass based on density formulas.
              </p>
            )}
          </div>

          <hr className="border-slate-200 dark:border-zinc-800" />

          {/* Real-time Pricing Comparison */}
          <div className="space-y-3">
            <p className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground font-bold">Base Rates Comparison</p>
            
            {/* Road Spot rate */}
            <div className="p-3 bg-background border border-slate-200 dark:border-zinc-800 rounded-lg flex justify-between items-center">
              <div>
                <p className="text-xs font-semibold text-foreground">Road PTL (Spot)</p>
                <p className="text-[10px] text-muted-foreground">Unconsolidated shadow rate</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-foreground font-mono">
                  ₹{bookingResult ? (bookingResult.chargeable_weight * 14.5).toFixed(2) : localEstimates.roadPrice.toLocaleString()}
                </p>
                <p className="text-[9px] text-muted-foreground font-mono">₹14.50/kg</p>
              </div>
            </div>

            {/* Rail-Consolidated rate */}
            <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg flex justify-between items-center">
              <div>
                <p className="text-xs font-semibold text-primary">Rail-Consolidated</p>
                <p className="text-[10px] text-primary/80">Wholesale co-loaded price</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary font-mono">
                  ₹{bookingResult ? bookingResult.final_quote.toLocaleString() : localEstimates.railPrice.toLocaleString()}
                </p>
                <p className="text-[9px] text-primary/80 font-mono">
                  {railLockEnabled ? '₹10.08/kg' : '₹9.00/kg'}
                </p>
              </div>
            </div>

            {/* Quick trigger for Rail Container Availability */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('lonics:open-rail-booking'))}
              className="w-full py-2 px-3 rounded-lg text-xs font-mono border border-primary/30 bg-primary/5 text-primary hover:bg-primary/15 transition flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-1.5 font-bold">
                <Train className="h-3.5 w-3.5" />
                <span>Live Rail Container Departures</span>
              </span>
              <span className="text-[10px] underline">Check Slots →</span>
            </button>
          </div>

          {/* Rail-Lock Toggle Switch */}
          <div className="p-3 bg-muted/40 border border-slate-200 dark:border-zinc-800 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="rail-lock" className="text-xs text-foreground font-semibold cursor-pointer select-none">
                Rail-Lock Upgrade
              </label>
              <button
                type="button"
                id="rail-lock"
                onClick={() => setRailLockEnabled(!railLockEnabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                  railLockEnabled ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    railLockEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground leading-normal">
              Applies a 12% wholesale margin buffer. Locks price against sudden seasonal truck road rate spikes.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <div className="space-y-3">
          <button
            type="button"
            disabled={isBooking || isScanning}
            onClick={handleConfirmBooking}
            className={`w-full h-12 md:h-auto md:py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition border cursor-pointer ${
              isBooking || isScanning
                ? 'bg-muted border-slate-200 dark:border-zinc-800 text-muted-foreground cursor-not-allowed'
                : 'bg-emerald-600 border-emerald-500 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/10'
            }`}
          >
            {isBooking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <IndianRupee className="h-3.5 w-3.5" />
            )}
            {isBooking ? 'Processing Booking...' : 'Confirm LCL Booking'}
          </button>

          {railLockEnabled && (
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-2 text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>Rail-Lock Rate Secured and Volatility Insulated.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const arePropsEqual = (prevProps: any, nextProps: any) => {
  const prevKeys = Object.keys(prevProps);
  const nextKeys = Object.keys(nextProps);
  if (prevKeys.length !== nextKeys.length) return false;
  for (const key of prevKeys) {
    if (prevProps[key] !== nextProps[key]) return false;
  }
  return true;
};

export default memo(QuotingConsole, arePropsEqual);
