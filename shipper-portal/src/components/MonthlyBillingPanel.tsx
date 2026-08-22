import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  CreditCard,
  CheckCircle2,
  Download,
  FileText,
  Clock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Building2,
  QrCode,
  Landmark,
  Wallet,
  Loader2,
  RefreshCw,
  Receipt,
} from 'lucide-react';
import { formatINR } from '../utils/cancellationEngine';
import { getAllShipmentsTracking, type ShipmentTrackingRecord } from '../utils/api';

export interface MonthlyBillingPanelProps {
  activeBookingId?: string | null;
}

type PaymentMethod = 'UPI' | 'NET_BANKING' | 'CORPORATE_CARD' | 'NEFT_RTGS';

interface InvoiceHistoryItem {
  id: string;
  cycle: string;
  amount: number;
  paidOn: string;
  status: 'PAID' | 'SETTLED';
  shipmentCount: number;
}

const PAST_INVOICES: InvoiceHistoryItem[] = [
  {
    id: 'INV-2026-JUL-7740',
    cycle: '01 Jul 2026 – 31 Jul 2026',
    amount: 84210,
    paidOn: '02 Aug 2026',
    status: 'PAID',
    shipmentCount: 5,
  },
  {
    id: 'INV-2026-JUN-6619',
    cycle: '01 Jun 2026 – 30 Jun 2026',
    amount: 68500,
    paidOn: '03 Jul 2026',
    status: 'PAID',
    shipmentCount: 4,
  },
  {
    id: 'INV-2026-MAY-5502',
    cycle: '01 May 2026 – 31 May 2026',
    amount: 92400,
    paidOn: '04 Jun 2026',
    status: 'PAID',
    shipmentCount: 6,
  },
];

export const MonthlyBillingPanel: React.FC<MonthlyBillingPanelProps> = ({ activeBookingId }) => {
  const [liveShipments, setLiveShipments] = useState<
    { id: string; origin: string; destination: string; amount: number; status: string }[]
  >([
    { id: 'BK-8930', origin: 'Mumbai Port', destination: 'Delhi ICD', amount: 16650, status: 'IN_TRANSIT' },
    { id: 'BK-4102', origin: 'Ludhiana ICD', destination: 'Mumbai Port', amount: 21600, status: 'REROUTED_GRAP_ACTIVE' },
    { id: 'BK-7729', origin: 'Dadri Hub', destination: 'Chennai Port', amount: 27900, status: 'IN_TRANSIT' },
    { id: 'BK-9514', origin: 'Ahmedabad Hub', destination: 'Kolkata Port', amount: 12600, status: 'IN_TRANSIT' },
  ]);

  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('UPI');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'DUE' | 'PAID'>('DUE');
  const [paidTxnId, setPaidTxnId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Handle ESC key to safely close payment modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showPaymentModal && !isProcessingPayment) {
        setShowPaymentModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPaymentModal, isProcessingPayment]);

  // Lock body/HTML scroll when payment modal is open
  useEffect(() => {
    if (!showPaymentModal) return;
    const origBody = document.body.style.overflow;
    const origHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = origBody;
      document.documentElement.style.overflow = origHtml;
    };
  }, [showPaymentModal]);

  // Poll real active shipments from API
  useEffect(() => {
    const fetchShipments = async () => {
      try {
        const records: ShipmentTrackingRecord[] = await getAllShipmentsTracking();
        if (Array.isArray(records) && records.length > 0) {
          const formatted = records.map((r) => {
            let baseAmt = 16650;
            if (r.booking_id === 'BK-4102') baseAmt = 21600;
            else if (r.booking_id === 'BK-7729') baseAmt = 27900;
            else if (r.booking_id === 'BK-9514') baseAmt = 12600;
            else if (r.booking_id.startsWith('BK-')) baseAmt = 14500;

            return {
              id: r.booking_id,
              origin: r.origin ? r.origin.split(' ')[0] : 'Mumbai',
              destination: r.destination ? r.destination.split(' ')[0] : 'Delhi',
              amount: r.status === 'CANCELLED' ? 5400 : baseAmt, // Reflect net cost post-cancellation deduction
              status: r.status || 'IN_TRANSIT',
            };
          });
          setLiveShipments(formatted);
        }
      } catch (err) {
        // Fallback to initial live shipments
      }
    };

    fetchShipments();
    const interval = setInterval(fetchShipments, 8000);
    return () => clearInterval(interval);
  }, []);

  // When activeBookingId is newly created, append to live list if not already present
  useEffect(() => {
    if (!activeBookingId) return;
    setLiveShipments((prev) => {
      if (prev.some((s) => s.id === activeBookingId)) return prev;
      return [
        {
          id: activeBookingId,
          origin: 'Mumbai Port',
          destination: 'Delhi ICD',
          amount: 14500,
          status: 'RESERVATION_INITIATED',
        },
        ...prev,
      ];
    });
  }, [activeBookingId]);

  // Compute live financial figures dynamically
  const billingCalculations = useMemo(() => {
    const baseFreightTotal = liveShipments.reduce((sum, item) => sum + item.amount, 0);
    const demurrageAndDetention = 1450; // Terminal yard staging buffer charges
    const greenFreightSurcharge = Math.round(baseFreightTotal * 0.025); // 2.5% Railway green fuel cess
    const subtotal = baseFreightTotal + demurrageAndDetention + greenFreightSurcharge;
    const gstRate = 0.18; // 18% Multi-Modal Logistics GST (9% CGST + 9% SGST)
    const gstAmount = Math.round(subtotal * gstRate);
    const totalAmount = subtotal + gstAmount;

    return {
      baseFreightTotal,
      demurrageAndDetention,
      greenFreightSurcharge,
      subtotal,
      gstAmount,
      totalAmount,
    };
  }, [liveShipments]);

  // Execute demo payment confirmation
  const handleExecutePayment = async () => {
    setIsProcessingPayment(true);
    await new Promise((res) => setTimeout(res, 900));

    const generatedTxn = `TXN-LON-${Math.floor(Math.random() * 89999999 + 10000000)}`;
    setPaidTxnId(generatedTxn);
    setPaymentStatus('PAID');
    setIsProcessingPayment(false);
    setShowPaymentModal(false);

    setToastMessage(`Payment of ${formatINR(billingCalculations.totalAmount)} confirmed! Ref: ${generatedTxn}`);
    setTimeout(() => setToastMessage(null), 6000);
  };

  const handleDownloadInvoice = (invoiceId: string) => {
    setToastMessage(`Downloading official tax invoice: ${invoiceId}.pdf`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="bg-card/45 border border-slate-200 dark:border-zinc-800 backdrop-blur-md rounded-xl p-3.5 sm:p-4 shadow-xl space-y-3 text-foreground animate-fade-in select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs font-mono text-emerald-600 dark:text-emerald-400 flex items-center justify-between gap-2 shadow-md animate-fade-in">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-muted-foreground hover:text-foreground font-bold text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header with Title, Cycle, and GSTIN */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-200 dark:border-zinc-800 pb-2.5">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="p-1 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center">
              <Receipt className="h-3.5 w-3.5" />
            </span>
            <h2 className="font-bold text-sm sm:text-base tracking-tight text-foreground">
              Monthly Freight Billing & Invoicing
            </h2>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
            Cycle: <strong className="text-foreground">01 Aug – 31 Aug 2026</strong> • Net-15
          </p>
        </div>

        <div className="text-left sm:text-right">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase border ${
              paymentStatus === 'PAID'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 shadow-sm'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
            }`}
          >
            {paymentStatus === 'PAID' ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                <span>PAID {paidTxnId ? `• ${paidTxnId}` : '• SETTLED'}</span>
              </>
            ) : (
              <>
                <Clock className="h-3 w-3 text-amber-500" />
                <span>PAYMENT DUE · 31 AUG</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Main Billing Amount Highlight Card */}
      <div className="p-3 bg-gradient-to-br from-card via-card to-emerald-500/5 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-inner space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
              CURRENT MONTH'S TOTAL PAYABLE
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-foreground">
                {formatINR(billingCalculations.totalAmount)}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                (Incl. 18% GST)
              </span>
            </div>
          </div>

          {/* Pay Now Button */}
          {paymentStatus === 'DUE' ? (
            <button
              type="button"
              id="billing-pay-now-btn"
              onClick={() => setShowPaymentModal(true)}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>Pay Now ({formatINR(billingCalculations.totalAmount)})</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleDownloadInvoice('INV-2026-AUG-8821')}
                className="px-3 py-1.5 rounded-lg bg-muted/60 hover:bg-muted text-foreground border border-border font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-primary" />
                <span>Download PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentStatus('DUE')}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition cursor-pointer"
                title="Reset to Unpaid Demo State"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* GSTIN & Invoice Details Bar */}
        <div className="pt-1.5 border-t border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between text-[9px] font-mono text-muted-foreground gap-1.5">
          <div className="flex items-center gap-1.5">
            <span>INV: <strong className="text-foreground">INV-2026-AUG-8821</strong></span>
            <span>•</span>
            <span>GSTIN: <strong className="text-foreground">27AAACL1234F1Z5</strong></span>
          </div>
          <span>
            {liveShipments.length} Active Shipments Tracked
          </span>
        </div>
      </div>

      {/* Collapsible Charge Breakdown */}
      <div className="border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-background">
        <button
          type="button"
          onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
          className="w-full p-2.5 flex items-center justify-between text-xs font-semibold text-foreground hover:bg-muted/30 transition cursor-pointer"
        >
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <FileText className="h-3.5 w-3.5 text-primary" />
            <span>Itemized Breakdown ({liveShipments.length} Consignments)</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground font-mono text-[10px]">
            <span>{isDetailsExpanded ? 'Hide' : 'View'}</span>
            {isDetailsExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </div>
        </button>

        {isDetailsExpanded && (
          <div className="p-3.5 pt-0 space-y-3 border-t border-slate-200 dark:border-zinc-800 animate-fade-in text-xs font-mono">
            {/* Per-Shipment Rows */}
            <div className="space-y-1.5 pt-2">
              <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider pb-1 border-b border-border/50 flex justify-between">
                <span>Shipment Corridor & Ref</span>
                <span>Base Freight</span>
              </div>

              {liveShipments.map((shipment) => (
                <div key={shipment.id} className="flex justify-between items-center py-1 border-b border-slate-200/40 dark:border-zinc-800/40">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{shipment.id}</span>
                    <span className="text-[10px] text-muted-foreground">
                      ({shipment.origin} ➔ {shipment.destination})
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-muted/60 text-muted-foreground uppercase">
                      {shipment.status.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="font-semibold text-foreground">{formatINR(shipment.amount)}</span>
                </div>
              ))}
            </div>

            {/* Surcharges & Taxes */}
            <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-zinc-800 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Base Line-Haul Rail Freight Subtotal</span>
                <span className="text-foreground font-semibold">{formatINR(billingCalculations.baseFreightTotal)}</span>
              </div>

              <div className="flex justify-between text-muted-foreground">
                <span>Terminal Yard Staging & Demurrage</span>
                <span className="text-foreground font-semibold">{formatINR(billingCalculations.demurrageAndDetention)}</span>
              </div>

              <div className="flex justify-between text-muted-foreground">
                <span>Railway Green Fuel & Peak Surcharge (2.5%)</span>
                <span className="text-foreground font-semibold">{formatINR(billingCalculations.greenFreightSurcharge)}</span>
              </div>

              <div className="flex justify-between text-muted-foreground">
                <span>Multi-Modal GST (18% — CGST 9% + SGST 9%)</span>
                <span className="text-foreground font-semibold">{formatINR(billingCalculations.gstAmount)}</span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-zinc-800 text-sm font-bold">
                <span className="text-foreground">Net Invoice Payable</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono text-base">
                  {formatINR(billingCalculations.totalAmount)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Collapsible Past Invoices Billing History */}
      <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-background">
        <button
          type="button"
          onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
          className="w-full p-3 flex items-center justify-between text-xs font-semibold text-foreground hover:bg-muted/30 transition cursor-pointer"
        >
          <div className="flex items-center gap-2 font-mono">
            <Building2 className="h-4 w-4 text-sky-500" />
            <span>Past Invoices & Billing Archive ({PAST_INVOICES.length} Settled)</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground font-mono text-[11px]">
            <span>{isHistoryExpanded ? 'Hide History' : 'View Past Invoices'}</span>
            {isHistoryExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>

        {isHistoryExpanded && (
          <div className="p-3.5 pt-0 space-y-2 border-t border-slate-200 dark:border-zinc-800 animate-fade-in text-xs font-mono">
            <div className="space-y-2 pt-2">
              {PAST_INVOICES.map((inv) => (
                <div
                  key={inv.id}
                  className="p-2.5 bg-muted/20 border border-slate-200 dark:border-zinc-800 rounded-lg flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{inv.id}</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        {inv.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {inv.cycle} • Paid {inv.paidOn}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-bold text-foreground">{formatINR(inv.amount)}</span>
                    <button
                      type="button"
                      onClick={() => handleDownloadInvoice(inv.id)}
                      className="p-1.5 rounded bg-muted hover:bg-muted/80 text-foreground transition cursor-pointer"
                      title="Download Invoice PDF"
                    >
                      <Download className="h-3.5 w-3.5 text-primary" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Payment Method Selector Modal — Portaled directly to document.body */}
      {showPaymentModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm overflow-hidden select-text"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-gateway-title"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isProcessingPayment) {
                setShowPaymentModal(false);
              }
            }}
          >
            <div
              className="relative w-full max-w-md bg-card border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[calc(100dvh-24px)] sm:max-h-[calc(100dvh-32px)] overflow-hidden text-foreground animate-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 1. Pinned Modal Header (shrink-0) */}
              <header className="shrink-0 p-4 sm:p-5 border-b border-border bg-muted/20 flex items-start justify-between">
                <div>
                  <h3 id="payment-gateway-title" className="text-base font-bold text-foreground flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                    SME Freight Payment Gateway
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    Invoice: INV-2026-AUG-8821 • GST Compliant
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  disabled={isProcessingPayment}
                  aria-label="Close payment modal"
                  className="p-1.5 -mr-1 -mt-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer disabled:opacity-50"
                >
                  ✕
                </button>
              </header>

              {/* 2. Scrollable Body Content (flex-1 min-h-0 overflow-y-auto) */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
                {/* Amount Payable Highlight */}
                <div className="p-3 bg-muted/40 border border-border rounded-xl flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground">Total Invoice Payable:</span>
                  <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {formatINR(billingCalculations.totalAmount)}
                  </span>
                </div>

                {/* Selectable Payment Mediums */}
                <div className="space-y-2">
                  <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
                    Select Payment Medium:
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    {/* UPI */}
                    <button
                      type="button"
                      onClick={() => setSelectedMethod('UPI')}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        selectedMethod === 'UPI'
                          ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm'
                          : 'bg-background border-border text-foreground hover:bg-muted/40'
                      }`}
                    >
                      <QrCode className="h-4 w-4 mb-1" />
                      <span className="text-xs">UPI / Dynamic QR</span>
                      <span className="text-[9px] text-muted-foreground font-normal">GPay, PhonePe, BHIM</span>
                    </button>

                    {/* Net Banking */}
                    <button
                      type="button"
                      onClick={() => setSelectedMethod('NET_BANKING')}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        selectedMethod === 'NET_BANKING'
                          ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm'
                          : 'bg-background border-border text-foreground hover:bg-muted/40'
                      }`}
                    >
                      <Landmark className="h-4 w-4 mb-1" />
                      <span className="text-xs">Corporate Net Banking</span>
                      <span className="text-[9px] text-muted-foreground font-normal">HDFC, ICICI, SBI, Axis</span>
                    </button>

                    {/* Corporate Card */}
                    <button
                      type="button"
                      onClick={() => setSelectedMethod('CORPORATE_CARD')}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        selectedMethod === 'CORPORATE_CARD'
                          ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm'
                          : 'bg-background border-border text-foreground hover:bg-muted/40'
                      }`}
                    >
                      <CreditCard className="h-4 w-4 mb-1" />
                      <span className="text-xs">Corporate Card</span>
                      <span className="text-[9px] text-muted-foreground font-normal">Visa, Master, RuPay</span>
                    </button>

                    {/* NEFT / RTGS */}
                    <button
                      type="button"
                      onClick={() => setSelectedMethod('NEFT_RTGS')}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                        selectedMethod === 'NEFT_RTGS'
                          ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm'
                          : 'bg-background border-border text-foreground hover:bg-muted/40'
                      }`}
                    >
                      <Wallet className="h-4 w-4 mb-1" />
                      <span className="text-xs">NEFT / RTGS Wire</span>
                      <span className="text-[9px] text-muted-foreground font-normal">Direct Virtual Account</span>
                    </button>
                  </div>
                </div>

                {/* Method Details Box */}
                <div className="p-3 bg-muted/25 border border-border rounded-xl text-[11px] font-mono text-muted-foreground space-y-1">
                  {selectedMethod === 'UPI' && (
                    <p>Scan instant BharatQR code via your UPI app or authorize VPA: <strong className="text-foreground">lonics.settle@okhdfcbank</strong></p>
                  )}
                  {selectedMethod === 'NET_BANKING' && (
                    <p>Direct corporate debit authorization via HDFC Corporate / SBI Saral corporate portal.</p>
                  )}
                  {selectedMethod === 'CORPORATE_CARD' && (
                    <p>Commercial freight card: <strong className="text-foreground">•••• •••• •••• 4082</strong> (Exp: 09/29)</p>
                  )}
                  {selectedMethod === 'NEFT_RTGS' && (
                    <p>Transfer to Virtual A/C: <strong className="text-foreground">LONICS9900284729</strong> (IFSC: HDFC0000001)</p>
                  )}
                </div>
              </div>

              {/* 3. Pinned Modal Actions Footer (shrink-0) */}
              <footer className="shrink-0 p-3.5 sm:p-4 border-t border-border bg-muted/20 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  disabled={isProcessingPayment}
                  className="px-3.5 py-2 rounded-xl border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="billing-confirm-pay-btn"
                  onClick={handleExecutePayment}
                  disabled={isProcessingPayment}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-60"
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Authorizing...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Authorize {formatINR(billingCalculations.totalAmount)}</span>
                    </>
                  )}
                </button>
              </footer>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default MonthlyBillingPanel;
