import { Wallet, IndianRupee } from 'lucide-react';
import type { BillingData } from '../../data/previewData';

interface BillingSectionProps {
  billing: BillingData;
}

export default function BillingSection({ billing }: BillingSectionProps) {
  const { breakdown } = billing;

  return (
    <div className="h-full flex flex-col justify-between bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm text-card-foreground">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Wallet className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] sm:text-xs font-mono font-semibold tracking-wider text-muted-foreground uppercase">
            Expenditure
          </span>
        </div>
        <span className="text-[10px] sm:text-[11px] font-mono text-muted-foreground">
          {billing.billingPeriod}
        </span>
      </div>

      {/* Main Spend Figures */}
      <div className="my-2 flex items-baseline justify-between">
        <div>
          <div className="text-[9px] font-mono text-muted-foreground uppercase">Total Billed</div>
          <div className="flex items-center text-lg sm:text-2xl font-mono font-bold text-foreground">
            <IndianRupee className="w-4 h-4 sm:w-5 sm:h-5 text-primary -mr-0.5" />
            {billing.currentMonthSpendRupees.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="text-right">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] sm:text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            ↓ {Math.abs(billing.previousMonthDeltaPercent)}% vs last month
          </span>
        </div>
      </div>

      {/* Segmented Distribution Bar */}
      <div className="space-y-1.5 my-1">
        <div className="w-full h-2 rounded-full overflow-hidden flex bg-muted">
          <div
            className="bg-primary h-full"
            style={{ width: `${breakdown.railPercent}%` }}
            title={`Rail: ${breakdown.railPercent}%`}
          />
          <div
            className="bg-primary/70 h-full"
            style={{ width: `${breakdown.lastMilePercent}%` }}
            title={`Last-Mile: ${breakdown.lastMilePercent}%`}
          />
          <div
            className="bg-amber-500 h-full"
            style={{ width: `${breakdown.terminalPercent}%` }}
            title={`Terminal: ${breakdown.terminalPercent}%`}
          />
        </div>

        {/* Breakdown Badges */}
        <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono text-muted-foreground">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            <span>RAIL {breakdown.railPercent}%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/70" />
            <span>LAST-MILE {breakdown.lastMilePercent}%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>TERMINAL {breakdown.terminalPercent}%</span>
          </div>
        </div>
      </div>

      {/* Footer subtle telemetry */}
      <div className="flex items-center justify-between pt-1 text-[9px] sm:text-[10px] font-mono text-muted-foreground">
        <span>ARBITRAGE SAVINGS</span>
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
          ₹{billing.savingsRealizedRupees.toLocaleString('en-IN')} REALIZED
        </span>
      </div>
    </div>
  );
}
