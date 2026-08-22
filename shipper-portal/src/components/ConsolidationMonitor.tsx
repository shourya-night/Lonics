import React, { useState, useEffect, memo } from 'react';
import { Terminal, Play, Square, BarChart2 } from 'lucide-react';
import { getContainerStatus } from '../utils/api';
import ContainerFillVisualizer from './ContainerFillVisualizer';

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

// Log style picker helper
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

// Memoized terminal log feed sub-component
const TerminalFeed = React.memo(function TerminalFeed({ logs }: { logs: LogMessage[] }) {
  return (
    <div className="bg-background border border-slate-200 dark:border-zinc-800 rounded-lg p-3 font-mono text-[10px] space-y-2 h-32 overflow-y-auto select-none">
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
  const [volume, setVolume] = useState(24.1); // Operational demo baseline: 24.1 CBM
  const [mass, setMass] = useState(14200.0);   // Operational demo baseline: 14.2T
  const [maxVolume, setMaxVolume] = useState(28.0);
  const [maxMass, setMaxMass] = useState(18000.0);
  const [windowId, setWindowId] = useState('WIN-PRIMARY-DFC');
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [isLoggingActive, setIsLoggingActive] = useState(true);

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
        if (status.current_cbm > 0) setVolume(status.current_cbm);
        if (status.current_kg > 0) setMass(status.current_kg);
        if (status.window_id) setWindowId(status.window_id);
        if (status.max_cbm_threshold) setMaxVolume(status.max_cbm_threshold);
        if (status.max_kg_threshold) setMaxMass(status.max_kg_threshold);
      } catch (err) {
        console.error('Error fetching container status:', err);
      }
    };
    fetchStatus();

    // Setup polling interval every 12 seconds
    const interval = setInterval(async () => {
      if (isLoggingActive) {
        try {
          const status = await getContainerStatus();
          
          if (status.window_id && status.window_id !== windowId) {
            setWindowId(status.window_id);
            const newLog: LogMessage = {
              timestamp: new Date().toLocaleTimeString(),
              agent: 'CONSOLIDATION_AGENT',
              message: `Threshold limit warning/breach triggered new window assignment: ${status.window_id}`,
              type: 'warn',
            };
            setLogs((prev) => [...prev.slice(1), newLog]);
          }

          if (status.current_cbm > 0) setVolume(status.current_cbm);
          if (status.current_kg > 0) setMass(status.current_kg);
          if (status.max_cbm_threshold) setMaxVolume(status.max_cbm_threshold);
          if (status.max_kg_threshold) setMaxMass(status.max_kg_threshold);
        } catch (err) {
          console.error('Polling error:', err);
        }

        // Keep agent telemetry feed active
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
          <p className="text-xs text-muted-foreground">
            Shared container co-loading volumetric & mass fill margins
          </p>
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

      {/* Primary Functional Container Fill Visualization */}
      <ContainerFillVisualizer
        volumeCbm={volume}
        maxVolumeCbm={maxVolume}
        massKg={mass}
        maxMassKg={maxMass}
        windowId={windowId}
        containerType="40ft High-Cube Intermodal Rail Van"
      />

      {/* Live Operational State Logs (Scrolling Terminal) */}
      <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-zinc-800">
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
