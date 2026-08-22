import { useState, useEffect } from 'react';
import { Activity, ShieldCheck } from 'lucide-react';
import type { PreviewTelemetry } from '../../data/previewData';

interface PreviewHeaderProps {
  telemetry: PreviewTelemetry;
}

export default function PreviewHeader({ telemetry }: PreviewHeaderProps) {
  const [currentTimestamp, setCurrentTimestamp] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const day = now.getDate().toString().padStart(2, '0');
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const month = months[now.getMonth()];
      const year = now.getFullYear();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      setCurrentTimestamp(`${day} ${month} ${year} · ${hours}:${minutes}:${seconds} IST`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="w-full shrink-0 flex flex-col sm:flex-row items-center justify-between gap-2 pb-3 border-b border-border">
      {/* Brand & Mode */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-xl sm:text-2xl tracking-tighter text-foreground">
            LONICS
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20 tracking-wider">
            OPERATIONS PREVIEW
          </span>
        </div>
      </div>

      {/* Live Clock & Isolated Mock Telemetry */}
      <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 sm:gap-4 text-[10px] sm:text-xs font-mono text-muted-foreground">
        {/* Real Live Timestamp */}
        <span className="text-foreground font-medium tracking-wide">
          {currentTimestamp || 'LIVE TELEMETRY'}
        </span>

        <span className="hidden md:inline text-border">|</span>

        {/* Mock Operational Status */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>SYSTEM {telemetry.systemStatus}</span>
        </div>

        <span className="hidden lg:inline text-border">|</span>

        {/* Mock Telemetry Metrics */}
        <div className="hidden lg:flex items-center gap-3 text-muted-foreground">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-primary" />
            {telemetry.activeAgentsCount} AGENTS
          </span>
          <span className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            {telemetry.simulatedLatencyMs}ms
          </span>
        </div>
      </div>
    </header>
  );
}
