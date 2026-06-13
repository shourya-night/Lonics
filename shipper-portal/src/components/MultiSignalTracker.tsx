import React, { useState, useEffect, useMemo, memo } from 'react';
import { Wifi, WifiOff, AlertTriangle, RefreshCw, Terminal, CheckCircle, Ban, Loader2, Camera } from 'lucide-react';
import { cancelFreight, getTrackingStatus } from '../utils/api';
import SealVerifier from './SealVerifier';

interface TelemetrySignal {
  layer: string;
  source: string;
  value: string;
  status: 'active' | 'offline' | 'fallback';
  latencyMs: number;
}

interface KafkaEvent {
  timestamp: string;
  partition: number;
  offset: number;
  message: string;
  severity: 'info' | 'warn' | 'error' | 'success';
}

const KafkaQueueFeed = React.memo(function KafkaQueueFeed({ kafkaLogs }: { kafkaLogs: KafkaEvent[] }) {
  return (
    <div className="bg-background border border-slate-200 dark:border-zinc-800 rounded-lg p-3 font-mono text-[10px] space-y-2 max-h-[200px] overflow-y-auto select-none">
      {kafkaLogs.length === 0 ? (
        <div className="text-muted-foreground text-center py-6">
          No active event triggers in Kafka Partition queue
        </div>
      ) : (
        kafkaLogs.map((log, index) => (
          <div key={index} className="border-b border-slate-200 dark:border-zinc-800 pb-1.5 last:border-b-0">
            <div className="flex justify-between items-center text-[9px] mb-0.5">
              <span className={`font-bold uppercase ${
                log.severity === 'error' 
                  ? 'text-rose-500 dark:text-rose-400' 
                  : log.severity === 'warn' 
                    ? 'text-amber-500 dark:text-amber-400' 
                    : log.severity === 'success'
                      ? 'text-emerald-500 dark:text-emerald-400'
                      : 'text-cyan-500 dark:text-orange-500'
              }`}>
                {log.severity} • Partition {log.partition} • Offset {log.offset}
              </span>
              <span className="text-muted-foreground">{log.timestamp}</span>
            </div>
            <p className="text-muted-foreground leading-normal">{log.message}</p>
          </div>
        ))
      )}
    </div>
  );
});

interface MultiSignalTrackerProps {
  activeBookingId?: string | null;
}

function MultiSignalTracker({ activeBookingId }: MultiSignalTrackerProps) {
  const [isDelayed, setIsDelayed] = useState(false);
  const [transitProgress, setTransitProgress] = useState(65);
  const [kafkaLogs, setKafkaLogs] = useState<KafkaEvent[]>([]);
  const [activeTab, setActiveTab] = useState<'signals' | 'kafka'>('signals');
  
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelStatus, setCancelStatus] = useState<string | null>(null);

  // Live API states
  const [trackingData, setTrackingData] = useState<any>(null);
  const [isScanningOCR, setIsScanningOCR] = useState(false);
  const [scanResultMsg, setScanResultMsg] = useState<string | null>(null);

  // Fetch tracking status periodically
  useEffect(() => {
    if (!activeBookingId) {
      setTrackingData(null);
      return;
    }

    const fetchTracking = async () => {
      try {
        const data = await getTrackingStatus(activeBookingId);
        setTrackingData(data);
        
        if (data.status === 'DELIVERED') {
          setTransitProgress(100);
        } else if (data.status === 'REROUTED_GRAP_ACTIVE') {
          setTransitProgress(82);
        } else if (data.status === 'CANCELLED') {
          setTransitProgress(0);
        } else {
          setTransitProgress(65);
        }
      } catch (err) {
        console.error('[Telemetry Fusion] API poll failure:', err);
      }
    };

    fetchTracking();
    const interval = setInterval(fetchTracking, 5000);
    return () => clearInterval(interval);
  }, [activeBookingId]);

  // Sync database updates into Kafka telemetry feed logs
  useEffect(() => {
    if (!trackingData) return;

    const time = () => new Date().toLocaleTimeString();
    const currentCoord = trackingData.telemetry.current_coordinates;
    const keyMsg = `[FUSION] Coordinates: Lat ${currentCoord.lat}, Lng ${currentCoord.lng} • Signal: ${trackingData.telemetry.signal_source}`;
    
    // Deduplicate log entries
    setKafkaLogs((prev) => {
      if (prev.length > 0 && prev[0].message.includes(currentCoord.lat.toString())) {
        return prev;
      }

      const freshLogs: KafkaEvent[] = [
        {
          timestamp: time(),
          partition: 3,
          offset: Math.floor(Math.random() * 50000) + 120000,
          message: keyMsg,
          severity: 'info'
        }
      ];

      if (trackingData.status === 'REROUTED_GRAP_ACTIVE') {
        freshLogs.push({
          timestamp: time(),
          partition: 1,
          offset: Math.floor(Math.random() * 1000) + 5000,
          message: `[GRAP SHIFT] Active AQI restriction triggers Stage III split routing. Feeder vehicles restricted to electric power only.`,
          severity: 'warn'
        });
      }

      if (trackingData.status === 'DELIVERED') {
        freshLogs.push({
          timestamp: time(),
          partition: 0,
          offset: Math.floor(Math.random() * 1000) + 9000,
          message: `[DELIVERY] Final gate seal scanned and matched. Cargo status closed.`,
          severity: 'success'
        });
      }

      return [...freshLogs, ...prev.slice(0, 15)];
    });
  }, [trackingData]);

  // Triggered logs on simulator click for delay
  const triggerKafkaDelayEvents = () => {
    const time = () => new Date().toLocaleTimeString();
    const newLogs: KafkaEvent[] = [
      { timestamp: time(), partition: 2, offset: 489201, message: 'FOIS API Connection failed: Connection pool exhausted (TimeoutException)', severity: 'error' },
      { timestamp: time(), partition: 2, offset: 489202, message: 'ULIP route resolver triggered fallback path search', severity: 'info' },
      { timestamp: time(), partition: 4, offset: 902148, message: '[KAFKA-RETRY-1] Socket read timed out. Retrying execution context in 2500ms...', severity: 'warn' },
      { timestamp: time(), partition: 4, offset: 902149, message: '[KAFKA-RETRY-2] Re-assigning consumer partition offsets from Dadri Node...', severity: 'warn' },
      { timestamp: time(), partition: 2, offset: 489205, message: 'Fusing NTES telemetry stream. Active confidence downgraded to 70%', severity: 'info' },
    ];
    setKafkaLogs((prev) => [...newLogs, ...prev.slice(0, 10)]);
  };

  const triggerKafkaRecoveryEvents = () => {
    const time = () => new Date().toLocaleTimeString();
    const newLogs: KafkaEvent[] = [
      { timestamp: time(), partition: 2, offset: 489210, message: 'FOIS API connection restored on fallback server #2', severity: 'info' },
      { timestamp: time(), partition: 2, offset: 489211, message: 'Consolidated geo-coordinates resolved successfully', severity: 'info' },
      { timestamp: time(), partition: 4, offset: 902155, message: 'Kafka consumer offset synchronized. Buffer size = 0', severity: 'info' },
    ];
    setKafkaLogs((prev) => [...newLogs, ...prev.slice(0, 10)]);
  };

  // Toggle Delay Simulation
  const handleToggleDelay = () => {
    const targetState = !isDelayed;
    setIsDelayed(targetState);
    if (targetState) {
      triggerKafkaDelayEvents();
      setActiveTab('kafka');
    } else {
      triggerKafkaRecoveryEvents();
    }
  };

  // Trigger backend cancellation Saga rollback simulation
  const handleSimulateCancellation = async () => {
    const targetBookingId = activeBookingId || 'BK-MOCK-999';
    setIsCancelling(true);
    setCancelStatus(`Sending cancellation payload for ${targetBookingId}...`);
    setActiveTab('kafka');

    try {
      const res = await cancelFreight(targetBookingId);
      
      const time = () => new Date().toLocaleTimeString();
      setKafkaLogs((prev) => [
        { timestamp: time(), partition: 0, offset: 100, message: `[API] Cancellation request accepted for ${targetBookingId}. Response Status: ${res.status}`, severity: 'info' },
        ...prev,
      ]);

      await new Promise((resolve) => setTimeout(resolve, 1000));
      setKafkaLogs((prev) => [
        { timestamp: time(), partition: 1, offset: 101, message: `[SAGA] [Step 1/3] [release_truck_hold] Canceled first-mile feeder truck reservation for ${targetBookingId}.`, severity: 'warn' },
        ...prev,
      ]);

      await new Promise((resolve) => setTimeout(resolve, 1000));
      setKafkaLogs((prev) => [
        { timestamp: time(), partition: 1, offset: 102, message: `[SAGA] [Step 2/3] [release_cto_slot] Released Container Train Operator (CTO) block allocation for ${targetBookingId}.`, severity: 'warn' },
        ...prev,
      ]);

      await new Promise((resolve) => setTimeout(resolve, 1000));
      setKafkaLogs((prev) => [
        { timestamp: time(), partition: 1, offset: 103, message: `[SAGA] [Step 3/3] [trigger_secondary_flash_auction] Triggered secondary backhaul spot auction for released CBM space.`, severity: 'success' },
        { timestamp: time(), partition: 0, offset: 104, message: `[SAGA] Rollback saga completed successfully for booking: ${targetBookingId}`, severity: 'success' },
        ...prev,
      ]);

      setCancelStatus(`Cancelled ${targetBookingId}`);
      setTransitProgress(0);
    } catch (err: any) {
      console.error(err);
      setCancelStatus('Failed to cancel');
    } finally {
      setIsCancelling(false);
    }
  };

  // Auto-increment progress slightly if not stalled
  useEffect(() => {
    if (isDelayed || isCancelling || transitProgress === 0 || transitProgress >= 100 || trackingData) return;
    const interval = setInterval(() => {
      setTransitProgress((prev) => (prev >= 100 ? 0 : prev + 0.5));
    }, 4000);
    return () => clearInterval(interval);
  }, [isDelayed, isCancelling, transitProgress, trackingData]);

  // Signals telemetry definition
  const signals = useMemo<TelemetrySignal[]>(() => {
    if (trackingData) {
      return [
        { 
          layer: 'FOIS Pravah API', 
          source: 'Indian Railways Central Gateway', 
          value: `GPS Resolved: Lat ${trackingData.telemetry.current_coordinates.lat}, Lng ${trackingData.telemetry.current_coordinates.lng} • Velocity: ${trackingData.telemetry.speed_kmh} km/h`, 
          status: trackingData.status === 'REROUTED_GRAP_ACTIVE' ? 'fallback' : 'active', 
          latencyMs: 35 
        },
        { 
          layer: 'AQI Metric Engine', 
          source: 'Open-Meteo Air Quality Live Feed', 
          value: `AQI: ${trackingData.aqi_metrics.aqi} (${trackingData.aqi_metrics.grap_stage}) • Source: ${trackingData.aqi_metrics.api_source}`, 
          status: trackingData.status === 'REROUTED_GRAP_ACTIVE' ? 'fallback' : 'active', 
          latencyMs: 82 
        },
        { 
          layer: 'Active Route Sequence', 
          source: 'OSRM Dynamic Coordinates', 
          value: trackingData.route.join(' ➔ '), 
          status: 'active', 
          latencyMs: 15 
        },
        { 
          layer: 'Ground Ops OCR', 
          source: 'OCR camera seal scan verify', 
          value: `Status: ${trackingData.status} • Window Cache: ${trackingData.assigned_window_id}`, 
          status: trackingData.status === 'DELIVERED' ? 'active' : 'fallback', 
          latencyMs: 12 
        }
      ];
    }

    if (isDelayed) {
      return [
        { layer: 'FOIS Pravah API', source: 'Indian Railways Central Gateway', value: 'Offline (API Read Timeout)', status: 'offline', latencyMs: 5000 },
        { layer: 'NTES Station Data', source: 'National Train Enquiry System', value: 'Station: DADRI ICD [DDR] • Train: LCL-EXP-92', status: 'fallback', latencyMs: 124 },
        { layer: 'CTO Container Feeds', source: 'Container Train Operator RFID', value: 'RFID Segment 42 - Stack Level B2', status: 'active', latencyMs: 45 },
        { layer: 'Ground Ops OCR', source: 'OCR wagon scanners (ICD Dadri)', value: 'Verified Seal Check: OK • Wagon No: CR-98104', status: 'active', latencyMs: 12 },
      ];
    }

    return [
      { layer: 'FOIS Pravah API', source: 'Indian Railways Central Gateway', value: 'GPS Resolving: Lat 28.53, Lng 77.55 • Velocity: 52 km/h', status: 'active', latencyMs: 24 },
      { layer: 'NTES Station Data', source: 'National Train Enquiry System', value: 'Station: IN TRANSIT • Next: MARIPAT [MPC]', status: 'active', latencyMs: 18 },
      { layer: 'CTO Container Feeds', source: 'Container Train Operator RFID', value: 'RFID Segment 42 - Stack Level B2', status: 'active', latencyMs: 38 },
      { layer: 'Ground Ops OCR', source: 'OCR wagon scanners (ICD Dadri)', value: 'Verified Seal Check: OK • Wagon No: CR-98104', status: 'active', latencyMs: 12 },
    ];
  }, [trackingData, isDelayed]);

  const confidenceBadge = useMemo(() => {
    if (isDelayed) {
      return {
        label: 'NTES_FALLBACK (70%)',
        style: 'bg-amber-950/40 text-amber-400 border-amber-800/80 shadow-[0_0_8px_rgba(245,158,11,0.15)]',
        desc: 'FOIS feed offline. Fusing NTES schedule updates with degraded confidence metrics.',
      };
    }

    if (trackingData?.status === 'REROUTED_GRAP_ACTIVE') {
      return {
        label: 'GRAP_STAGE_3_REROUTE (88%)',
        style: 'bg-[#FF6B00]/10 text-[#FF6B00] border-[#FF6B00]/30 shadow-[0_0_8px_rgba(255,107,0,0.15)]',
        desc: 'Severe AQI alert in NCR. Fleet rerouted to avoid heavy diesel vehicle municipal entry restrictions.',
      };
    }

    if (transitProgress >= 100 || trackingData?.status === 'DELIVERED') {
      return {
        label: 'LOCAL_VERIFIED_OCR (99%)',
        style: 'bg-blue-950/40 text-blue-400 border-blue-800/80 shadow-[0_0_8px_rgba(59,130,246,0.15)]',
        desc: 'Final delivery checklist scanned locally. Signal verified at Last-Mile destination gate.',
      };
    }

    return {
      label: 'DFC_LIVE (95%)',
      style: 'bg-emerald-950/40 text-emerald-400 border-emerald-800/80 shadow-[0_0_8px_rgba(16,185,129,0.15)]',
      desc: 'All signal layers online. Multi-source location coordinates fully synchronized.',
    };
  }, [isDelayed, transitProgress, trackingData]);

  // Handle successful Seal verification callback
  const handleSealVerifyComplete = (bookingId: string) => {
    setScanResultMsg(`Successfully scanned and verified seal code ${bookingId}`);
    setIsScanningOCR(false);
    
    // Auto-trigger a fetch refresh to show DELIVERED status immediately
    getTrackingStatus(bookingId).then(setTrackingData);
  };

  return (
    <div className="bg-card/45 border border-slate-200 dark:border-zinc-800 backdrop-blur-md rounded-xl p-5 shadow-2xl space-y-5 flex flex-col justify-between h-full">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex justify-between items-start gap-2 border-b border-slate-200 dark:border-zinc-800 pb-3">
          <div>
            <h2 className="font-bold text-lg text-foreground">Multi-Signal Tracking Terminal</h2>
            <p className="text-xs text-muted-foreground">Live multi-source cargo tracking telemetry</p>
          </div>
        </div>

        {/* Seal verification camera view inside tracker container when active */}
        {isScanningOCR && (
          <div className="border border-[#FF6B00]/45 rounded-lg overflow-hidden animate-fade-in">
            <SealVerifier
              activeBookingId={activeBookingId || 'BK-MOCK-999'}
              onVerifyComplete={handleSealVerifyComplete}
              onClose={() => setIsScanningOCR(false)}
            />
          </div>
        )}

        {/* Action Controls */}
        <div className="grid grid-cols-3 gap-2">
          {/* Feeder Delay */}
          <button
            type="button"
            onClick={handleToggleDelay}
            className={`px-1 py-1.5 rounded-lg text-[9px] font-semibold flex items-center justify-center gap-1 transition duration-200 border cursor-pointer ${
              isDelayed
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-rose-500/20'
                : 'bg-background border-slate-200 dark:border-zinc-800 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {isDelayed ? <RefreshCw className="h-3 w-3 text-rose-500 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
            {isDelayed ? 'FOIS Offline' : 'Delay Feeder'}
          </button>

          {/* OCR Scanner Activation */}
          <button
            type="button"
            onClick={() => {
              setIsScanningOCR(true);
              setScanResultMsg(null);
            }}
            className="px-1 py-1.5 bg-primary/10 border border-primary/30 hover:bg-primary/20 text-primary rounded-lg text-[9px] font-semibold flex items-center justify-center gap-1 transition duration-200 cursor-pointer"
          >
            <Camera className="h-3 w-3" />
            Verify Seal
          </button>

          {/* Simulate Cancellation */}
          <button
            type="button"
            disabled={isCancelling}
            onClick={handleSimulateCancellation}
            className={`px-1 py-1.5 rounded-lg text-[9px] font-semibold flex items-center justify-center gap-1 transition duration-200 border cursor-pointer ${
              isCancelling
                ? 'bg-background border-slate-200 dark:border-zinc-800 text-muted-foreground cursor-not-allowed'
                : 'bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-500'
            }`}
          >
            {isCancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
            {cancelStatus || 'Cancel Cargo'}
          </button>
        </div>

        {/* Scan result toast notification */}
        {scanResultMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-lg text-emerald-600 dark:text-emerald-400 text-[10px] font-mono flex items-center gap-1.5 animate-pulse">
            <CheckCircle className="h-3.5 w-3.5" />
            <span>{scanResultMsg}</span>
          </div>
        )}

        {/* Transit visual Pipeline */}
        <div className="bg-background/80 border border-slate-200 dark:border-zinc-800 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-foreground">Mumbai Port (First-Mile)</span>
            <span className={`font-bold font-mono ${
              isDelayed 
                ? 'text-rose-500' 
                : trackingData?.status === 'REROUTED_GRAP_ACTIVE' 
                  ? 'text-[#FF6B00] animate-pulse' 
                  : transitProgress === 0 
                    ? 'text-rose-500' 
                    : 'text-primary animate-pulse'
            }`}>
              {isDelayed 
                ? 'STALLED AT DADRI ICD' 
                : trackingData?.status === 'REROUTED_GRAP_ACTIVE'
                  ? 'GRAP REROUTE ACTIVE'
                  : transitProgress === 0 
                    ? 'CANCELED' 
                    : transitProgress >= 100 
                      ? 'ARRIVED AT DESTINATION' 
                      : 'IN LINE-HAUL DFC TRANSIT'}
            </span>
            <span className="font-semibold text-foreground">Delhi ICD (Last-Mile)</span>
          </div>

          <div className="relative h-2 w-full bg-background rounded-full border border-slate-200 dark:border-zinc-800">
            <div
              className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${
                isDelayed 
                  ? 'from-rose-600 to-rose-500' 
                  : trackingData?.status === 'REROUTED_GRAP_ACTIVE'
                    ? 'from-primary via-[#FF6B00] to-amber-500'
                    : 'from-primary to-blue-500'
              }`}
              style={{ width: `${transitProgress}%` }}
            ></div>
            <div
              className={`absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full border flex items-center justify-center transition-all duration-500 shadow-xl ${
                isDelayed
                  ? 'bg-rose-950 border-rose-500 text-rose-400 animate-ping'
                  : trackingData?.status === 'REROUTED_GRAP_ACTIVE'
                    ? 'bg-[#FF6B00]/20 border-[#FF6B00] text-[#FF6B00]'
                    : 'bg-primary/20 border-primary text-primary'
              }`}
              style={{ left: `calc(${transitProgress}% - 10px)` }}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${
                isDelayed 
                  ? 'bg-rose-500' 
                  : trackingData?.status === 'REROUTED_GRAP_ACTIVE'
                    ? 'bg-[#FF6B00]'
                    : 'bg-primary'
              }`}></span>
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono">
            <span>Progress: {transitProgress.toFixed(1)}%</span>
            <span>Uptime SLA: {isDelayed ? 'Violated (+2.4h)' : trackingData?.status === 'REROUTED_GRAP_ACTIVE' ? 'Re-Route Split (+45m)' : 'Normal'}</span>
          </div>
        </div>

        {/* Confidence Banner */}
        <div className={`p-3 border rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all duration-350 ${confidenceBadge.style}`}>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-current animate-pulse"></span>
              <span className="text-xs font-bold font-mono tracking-wider">{confidenceBadge.label}</span>
            </div>
            <p className="text-[10px] leading-relaxed opacity-90">{confidenceBadge.desc}</p>
          </div>
        </div>

        {/* Tabs for Signals vs Kafka logs */}
        <div className="flex border-b border-slate-200 dark:border-zinc-800">
          <button
            type="button"
            className={`px-4 py-2 text-xs font-semibold border-b-2 cursor-pointer transition ${
              activeTab === 'signals' ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('signals')}
          >
            Telemetry Channels
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-xs font-semibold border-b-2 cursor-pointer transition flex items-center gap-1.5 ${
              activeTab === 'kafka' ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('kafka')}
          >
            <Terminal className="h-3.5 w-3.5" /> Kafka Retry Queue
            {isDelayed && <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse"></span>}
          </button>
        </div>

        {/* Tab Content 1: Telemetry Signals */}
        {activeTab === 'signals' && (
          <div className="space-y-2.5">
            {signals.map((sig, idx) => (
              <div key={idx} className="flex justify-between items-center bg-background border border-slate-200 dark:border-zinc-800 p-2.5 rounded-lg text-xs animate-fade-in">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    {sig.status === 'active' && <Wifi className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />}
                    {sig.status === 'fallback' && <Wifi className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 animate-pulse" />}
                    {sig.status === 'offline' && <WifiOff className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" />}
                    <span className="font-bold text-foreground">{sig.layer}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{sig.source}</p>
                  <p className="font-mono text-[10px] text-foreground mt-1 pl-5">{sig.value}</p>
                </div>
                <div className="text-right font-mono text-[10px] text-muted-foreground">
                  Latency: <span className={sig.latencyMs > 100 ? 'text-amber-500 font-bold' : 'text-muted-foreground'}>{sig.latencyMs}ms</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab Content 2: Kafka Retry Queue */}
        {activeTab === 'kafka' && (
          <KafkaQueueFeed kafkaLogs={kafkaLogs} />
        )}
      </div>

      <div className="border-t border-slate-200 dark:border-zinc-800 pt-3 flex justify-between items-center text-[10px] font-mono text-muted-foreground">
        <span className="flex items-center gap-1">
          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> API Gateway: ULIP Connected
        </span>
        <span>Active ID: {activeBookingId || 'None'}</span>
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

export default memo(MultiSignalTracker, arePropsEqual);
