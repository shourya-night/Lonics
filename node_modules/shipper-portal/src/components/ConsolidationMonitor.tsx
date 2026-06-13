import React, { useState, useEffect, useMemo, memo } from 'react';
import { Package, Truck, Terminal, Play, Square, BarChart2 } from 'lucide-react';
import { getContainerStatus } from '../utils/api';

interface LogMessage {
  timestamp: string;
  agent: string;
  message: string;
  type: 'success' | 'info' | 'warn' | 'error';
}

const AGENT_SAMPLE_LOGS: { agent: string; message: string; type: 'success' | 'info' | 'warn' | 'error' }[] = [
  { agent: 'CONSOLIDATION_AGENT', message: 'Evaluating LCL packing windows using dual CBM + KG threshold boundaries.', type: 'info' },
  { agent: 'COMPATIBILITY_GUARD', message: 'Enforcing chemical, smell, and damage risk matrices across co-loaded items.', type: 'success' },
  { agent: 'DIM_WEIGHT_PRICING', message: 'Dynamically computed chargeable weight thresholds for newly scanned items.', type: 'info' },
  { agent: 'DUAL_BRAIN_PRICING', message: 'Queried contracted wholesale rail (₹9.00/kg) vs spot market road (₹14.50/kg) prices.', type: 'success' },
  { agent: 'RISK_GATE_AGENT', message: 'Transporter Reliability Score (TRS) calculated at 94.2% using FASTag tracking histories.', type: 'success' },
  { agent: 'MULTIMODAL_CONDUCTOR', message: 'Coordinating operational handoff from First-Mile trucking to line-haul rail.', type: 'info' },
  { agent: 'HYBRID_TRACKING_API', message: 'Fusing location coordinates from NTES train trackers and manual OCR entries.', type: 'info' },
  { agent: 'TRAJECTORY_PREDICTOR', message: 'Running 120-minute advance geofence predictions for approaching border checkpoints.', type: 'info' },
  { agent: 'URBAN_ROUTING_AGENT', message: 'Municipal ban detected for standard trucks. Splitting delivery volume into e-LCV fleets.', type: 'warn' },
  { agent: 'COMPLIANCE_NODE', message: 'Triggering automated e-Way Bill Part B update via ULIP gateway request.', type: 'success' },
  { agent: 'RETURN_EXCHANGE_NODE', message: 'Container Positioning Score (CPS) calculated at 8.7. Backhaul spot discount applied.', type: 'success' },
];

// Log style picker helper (moved outside to maintain stable reference)
const getLogStyle = (type: string) => {
  switch (type) {
    case 'success':
      return 'text-emerald-500 dark:text-emerald-400';
    case 'warn':
      return 'text-amber-500 dark:text-amber-400';
    case 'error':
      return 'text-rose-500 dark:text-rose-400';
    default:
      return 'text-cyan-500 dark:text-orange-500';
  }
};

// Memoized terminal log feed sub-component to block unnecessary cascading re-renders
const TerminalFeed = React.memo(function TerminalFeed({ logs }: { logs: LogMessage[] }) {
  return (
    <div className="bg-background border border-slate-200 dark:border-zinc-800 rounded-lg p-3 font-mono text-[10px] space-y-2 h-36 overflow-y-auto select-none">
      {logs.map((log, index) => (
        <div key={index} className="flex gap-2 items-start border-b border-slate-200 dark:border-zinc-800 pb-1">
          <span className="text-muted-foreground shrink-0 select-none">[{log.timestamp}]</span>
          <span className={`font-bold shrink-0 ${getLogStyle(log.type)}`}>
            {log.agent}
          </span>
          <span className="text-muted-foreground leading-normal">{log.message}</span>
        </div>
      ))}
    </div>
  );
});

function ConsolidationMonitor() {
  const [volume, setVolume] = useState(0.0); // Poll from backend
  const [mass, setMass] = useState(0.0);     // Poll from backend
  const [windowId, setWindowId] = useState('WIN-PRIMARY-DFC');
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [isLoggingActive, setIsLoggingActive] = useState(true);

  // Constants
  const maxVolume = 28.0;
  const maxMass = 18000.0;

  // Percentage calculations
  const volumePercent = useMemo(() => Math.min(100, Math.round((volume / maxVolume) * 100)), [volume]);
  const massPercent = useMemo(() => Math.min(100, Math.round((mass / maxMass) * 100)), [mass]);

  // Handle adding random logs and polling backend container status
  useEffect(() => {
    // Initial logs setup
    const initialLogs: LogMessage[] = AGENT_SAMPLE_LOGS.slice(0, 5).map((l, i) => ({
      timestamp: new Date(Date.now() - (5 - i) * 60000).toLocaleTimeString(),
      agent: l.agent,
      message: l.message,
      type: l.type,
    }));
    setLogs(initialLogs);

    // Initial status poll
    const fetchStatus = async () => {
      try {
        const status = await getContainerStatus();
        setVolume(status.current_cbm);
        setMass(status.current_kg);
        setWindowId(status.window_id);
      } catch (err) {
        console.error('Error fetching container status:', err);
      }
    };
    fetchStatus();

    // Setup polling interval every 12 seconds (throttled frequency)
    const interval = setInterval(async () => {
      if (isLoggingActive) {
        // Fetch container status metrics from backend
        try {
          const status = await getContainerStatus();
          
          // Detect window changes (container threshold breaches)
          if (status.window_id !== windowId) {
            setWindowId(status.window_id);
            const newLog: LogMessage = {
              timestamp: new Date().toLocaleTimeString(),
              agent: 'CONSOLIDATION_AGENT',
              message: `Threshold limit warning/breach triggered new window assignment: ${status.window_id}`,
              type: 'warn',
            };
            setLogs((prev) => [...prev.slice(1), newLog]);
          }

          setVolume(status.current_cbm);
          setMass(status.current_kg);
        } catch (err) {
          console.error('Polling error:', err);
        }

        // Add a random agent log event just to keep terminal active
        const randomLogTemplate = AGENT_SAMPLE_LOGS[Math.floor(Math.random() * AGENT_SAMPLE_LOGS.length)];
        const newLog: LogMessage = {
          timestamp: new Date().toLocaleTimeString(),
          agent: randomLogTemplate.agent,
          message: randomLogTemplate.message,
          type: randomLogTemplate.type,
        };
        setLogs((prev) => [...prev.slice(1), newLog]);
      }
    }, 12000);

    return () => clearInterval(interval);
  }, [isLoggingActive, windowId]);

  return (
    <div className="bg-card/45 border border-slate-200 dark:border-zinc-800 backdrop-blur-md rounded-xl p-5 shadow-2xl space-y-6">
      
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-200 dark:border-zinc-800 pb-3">
        <div>
          <h2 className="font-bold text-lg text-foreground flex items-center gap-1.5">
            <BarChart2 className="h-5 w-5 text-primary" /> LCL Consolidation Monitor
          </h2>
          <p className="text-xs text-muted-foreground">Shared container co-loading volumetric & mass fill margins</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsLoggingActive(!isLoggingActive)}
            className={`p-1.5 rounded border transition duration-150 cursor-pointer text-muted-foreground hover:text-foreground ${
              isLoggingActive ? 'bg-background border-slate-200 dark:border-zinc-800' : 'bg-primary/10 border border-primary/30 text-primary'
            }`}
            title={isLoggingActive ? 'Pause Event Logger' : 'Resume Event Logger'}
          >
            {isLoggingActive ? (
              <Square className="h-4 w-4 shrink-0 fill-current" />
            ) : (
              <Play className="h-4 w-4 shrink-0 fill-current" />
            )}
          </button>
        </div>
      </div>

      {/* Main progress details */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        
        {/* Visual Container schematic */}
        <div className="md:col-span-5 bg-background/80 border border-slate-200 dark:border-zinc-800 p-4 rounded-xl flex flex-col justify-center items-center h-48 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent"></div>
          
          {/* Container outline */}
          <div className="w-48 h-28 border-2 border-slate-200 dark:border-zinc-800 rounded bg-background/50 relative p-1 z-10 flex flex-col justify-end">
            <div className="absolute inset-x-0 top-0 text-[8px] font-mono text-muted-foreground text-center uppercase tracking-widest pt-1.5 truncate px-1">
              Container: {windowId}
            </div>
            
            {/* Visual co-load density blocks */}
            <div className="w-full flex items-end justify-start gap-1 p-1 h-3/4">
              <div
                className="bg-sky-600/40 border border-sky-500/50 rounded transition-all duration-550"
                style={{ width: '30%', height: `${volumePercent}%` }}
                title="Consolidation Batch A"
              ></div>
              <div
                className="bg-blue-600/30 border border-blue-500/50 rounded transition-all duration-550"
                style={{ width: '45%', height: `${Math.min(90, volumePercent * 0.9)}%` }}
                title="Consolidation Batch B"
              ></div>
              <div
                className="bg-cyan-600/20 dark:bg-orange-500/20 border border-cyan-500/50 dark:border-orange-500/50 rounded transition-all duration-550"
                style={{ width: '20%', height: `${Math.max(10, volumePercent - 15)}%` }}
                title="Unbound buffer space"
              ></div>
            </div>
          </div>
          
          <div className="mt-3 text-[10px] font-mono text-muted-foreground z-10">
            Container Type: LCL High-Cube Dry Van (40ft Equivalent)
          </div>
        </div>

        {/* Dual threshold progress bars */}
        <div className="md:col-span-7 space-y-4">
          
          {/* Volume parameter */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Package className="h-4 w-4 text-primary" />
                <span>Volumetric Fill Status (CBM)</span>
              </div>
              <span className="font-mono text-primary font-bold">{volume.toFixed(2)} / {maxVolume} CBM ({volumePercent}%)</span>
            </div>
            
            <div className="h-3 w-full bg-background rounded-full border border-slate-200 dark:border-zinc-800 overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-primary rounded-full transition-all duration-550"
                style={{ width: `${volumePercent}%` }}
              ></div>
              <div className="absolute top-0 bottom-0 left-[80%] w-0.5 bg-rose-500/50 cursor-help" title="Optimization threshold margin"></div>
            </div>
            
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>Min Packing target: 20 CBM</span>
              <span>Max Capacity limit: 28 CBM</span>
            </div>
          </div>

          {/* Mass parameter */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Truck className="h-4 w-4 text-blue-400" />
                <span>Gross Payload Mass Margin (KG)</span>
              </div>
              <span className="font-mono text-blue-400 font-bold">
                {mass.toLocaleString()} / {maxMass.toLocaleString()} KG ({massPercent}%)
              </span>
            </div>

            <div className="h-3 w-full bg-background rounded-full border border-slate-200 dark:border-zinc-800 overflow-hidden relative">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-primary rounded-full transition-all duration-550"
                style={{ width: `${massPercent}%` }}
              ></div>
              <div className="absolute top-0 bottom-0 left-[85%] w-0.5 bg-rose-500/50" title="Axle payload rating limit"></div>
            </div>

            <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>Axle Rating Min: 12,000 KG</span>
              <span>Payload structural cap: 18,000 KG</span>
            </div>
          </div>

        </div>
      </div>

      {/* Live Operational State Logs (Scrolling Terminal) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Terminal className="h-4 w-4 text-primary" />
          <span>Operational States (Multi-Agent Telemetry Feed)</span>
        </div>
        
        <TerminalFeed logs={logs} />
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

export default memo(ConsolidationMonitor, arePropsEqual);
