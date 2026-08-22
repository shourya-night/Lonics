import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import {
  Wifi,
  WifiOff,
  AlertTriangle,
  RefreshCw,
  Terminal,
  CheckCircle,
  Ban,
  Loader2,
  TrendingDown,
  LayoutGrid,
  ArrowRight,
  Radio,
  Layers,
} from 'lucide-react';
import { cancelFreight, getAllShipmentsTracking, type ShipmentTrackingRecord } from '../utils/api';
import CancellationReviewModal from './CancellationReviewModal';
import { formatINR, type CancellationRefundSummary } from '../utils/cancellationEngine';
import { publishOperationalEvent } from '../services/operationalEvents';

export interface TrackedShipment {
  bookingId: string;
  origin: string;
  destination: string;
  commodity: string;
  status: string; // 'IN_TRANSIT' | 'REROUTED_GRAP_ACTIVE' | 'DELIVERED' | 'CANCELLED' | 'RESERVATION_INITIATED'
  stage: string;
  transitProgress: number; // 0 to 100
  uptimeSla: string;
  speedKmh: number;
  signalSource: string;
  heading: string;
  assignedWindowId: string;
  currentCoordinates: { lat: number; lng: number };
  aqiMetrics: {
    aqi: number;
    grapStage: string;
    activeRestrictions: string;
    apiSource: string;
  };
  route: string[];
  statusDescription: string;
  isDelayed: boolean;
  isCancelled: boolean;
  cancellationRefundAmount?: number | null;
  totalBookingAmount: number;
  lastPing: string;
}

interface TelemetrySignal {
  layer: string;
  source: string;
  value: string;
  status: 'active' | 'offline' | 'fallback';
  latencyMs: number;
}

interface KafkaEvent {
  timestamp: string;
  bookingId: string;
  partition: number;
  offset: number;
  message: string;
  severity: 'info' | 'warn' | 'error' | 'success';
}

const INITIAL_SHIPMENTS: TrackedShipment[] = [
  {
    bookingId: 'BK-8930',
    origin: 'Mumbai Port DFC Gate-1',
    destination: 'Delhi ICD Terminal-3',
    commodity: 'Precision Engineering & Automotive',
    status: 'IN_TRANSIT',
    stage: 'Line-Haul DFC Transit',
    transitProgress: 65,
    uptimeSla: 'Normal',
    speedKmh: 55,
    signalSource: 'FOIS_Pravah_Live',
    heading: 'North-East',
    assignedWindowId: 'WIN-PRIMARY-DFC',
    currentCoordinates: { lat: 22.84, lng: 74.52 },
    aqiMetrics: {
      aqi: 142,
      grapStage: 'STAGE_I_MODERATE',
      activeRestrictions: 'None',
      apiSource: 'Open-Meteo Air Quality',
    },
    route: ['Mumbai Port DFC Gate-1', 'Dadri ICD Gateway', 'Delhi ICD Terminal-3'],
    statusDescription: 'Western Dedicated Freight Corridor (W-DFC) line-haul block dispatch.',
    isDelayed: false,
    isCancelled: false,
    totalBookingAmount: 16650,
    lastPing: new Date().toISOString(),
  },
  {
    bookingId: 'BK-4102',
    origin: 'Ludhiana ICD Yard',
    destination: 'Mumbai Port DFC Gate-1',
    commodity: 'Textiles & Industrial Goods',
    status: 'REROUTED_GRAP_ACTIVE',
    stage: 'First-Mile Feeder Dispatch',
    transitProgress: 28,
    uptimeSla: 'Re-Route Split (+45m)',
    speedKmh: 38,
    signalSource: 'NTES_Fallback_Station',
    heading: 'South-West',
    assignedWindowId: 'WIN-NORTH-CORRIDOR',
    currentCoordinates: { lat: 30.90, lng: 75.85 },
    aqiMetrics: {
      aqi: 385,
      grapStage: 'STAGE_III_SEVERE',
      activeRestrictions: 'Commercial diesel ban in NCR; EV split required',
      apiSource: 'Open-Meteo Air Quality',
    },
    route: ['Ludhiana ICD Yard', 'Electric-LCV Split Gate (Dadri)', 'Mumbai Port DFC Gate-1'],
    statusDescription: 'NCR Stage-III GRAP restriction active. Load split into electric feeder fleet at Dadri.',
    isDelayed: false,
    isCancelled: false,
    totalBookingAmount: 21600,
    lastPing: new Date().toISOString(),
  },
  {
    bookingId: 'BK-7729',
    origin: 'Dadri Multi-Modal Hub',
    destination: 'Chennai Port Container Terminal',
    commodity: 'Industrial Electronics & Sensors',
    status: 'IN_TRANSIT',
    stage: 'Line-Haul Rail Corridor',
    transitProgress: 48,
    uptimeSla: 'Normal',
    speedKmh: 62,
    signalSource: 'FOIS_Pravah_Live',
    heading: 'South-East',
    assignedWindowId: 'WIN-SOUTH-EXPRESS',
    currentCoordinates: { lat: 20.45, lng: 78.90 },
    aqiMetrics: {
      aqi: 118,
      grapStage: 'STAGE_I_MODERATE',
      activeRestrictions: 'None',
      apiSource: 'Open-Meteo Air Quality',
    },
    route: ['Dadri Multi-Modal Hub', 'Nagpur Junction Yard', 'Chennai Port Container Terminal'],
    statusDescription: 'Express Container Train Operator (CTO) block moving via Grand Trunk freight spine.',
    isDelayed: false,
    isCancelled: false,
    totalBookingAmount: 27900,
    lastPing: new Date().toISOString(),
  },
  {
    bookingId: 'BK-9514',
    origin: 'Ahmedabad Logistics Hub',
    destination: 'Kolkata Port Docks',
    commodity: 'Electrical Switchgear & Fasteners',
    status: 'IN_TRANSIT',
    stage: 'Last-Mile Urban Delivery',
    transitProgress: 91,
    uptimeSla: 'Normal',
    speedKmh: 28,
    signalSource: 'FOIS_Pravah_Live',
    heading: 'East',
    assignedWindowId: 'WIN-EAST-CONNECT',
    currentCoordinates: { lat: 22.57, lng: 88.36 },
    aqiMetrics: {
      aqi: 165,
      grapStage: 'STAGE_II_POOR',
      activeRestrictions: 'None',
      apiSource: 'Open-Meteo Air Quality',
    },
    route: ['Ahmedabad Logistics Hub', 'Durgapur Freight Terminal', 'Kolkata Port Docks'],
    statusDescription: 'Approaching destination container yard. Last-mile gate delivery window active.',
    isDelayed: false,
    isCancelled: false,
    totalBookingAmount: 12600,
    lastPing: new Date().toISOString(),
  },
];

const KafkaQueueFeed = React.memo(function KafkaQueueFeed({
  kafkaLogs,
  selectedId,
}: {
  kafkaLogs: KafkaEvent[];
  selectedId: string | null;
}) {
  const filteredLogs = useMemo(() => {
    if (!selectedId) return kafkaLogs;
    return kafkaLogs.filter((l) => l.bookingId === selectedId || l.bookingId === 'GLOBAL');
  }, [kafkaLogs, selectedId]);

  return (
    <div className="bg-background border border-slate-200 dark:border-zinc-800 rounded-lg p-3 font-mono text-[10px] space-y-2 max-h-[220px] overflow-y-auto select-none">
      {filteredLogs.length === 0 ? (
        <div className="text-muted-foreground text-center py-6">
          No active event triggers in Kafka Partition queue for {selectedId || 'selected scope'}
        </div>
      ) : (
        filteredLogs.map((log, index) => (
          <div key={index} className="border-b border-slate-200 dark:border-zinc-800 pb-1.5 last:border-b-0">
            <div className="flex justify-between items-center text-[9px] mb-0.5">
              <span
                className={`font-bold uppercase ${
                  log.severity === 'error'
                    ? 'text-rose-500 dark:text-rose-400'
                    : log.severity === 'warn'
                    ? 'text-amber-500 dark:text-amber-400'
                    : log.severity === 'success'
                    ? 'text-emerald-500 dark:text-emerald-400'
                    : 'text-cyan-500 dark:text-orange-500'
                }`}
              >
                {log.severity} • {log.bookingId} • P{log.partition}:O{log.offset}
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

export interface MultiSignalTrackerProps {
  activeBookingId?: string | null;
}

export function MultiSignalTracker({ activeBookingId }: MultiSignalTrackerProps) {
  // Shipments state array
  const [shipments, setShipments] = useState<TrackedShipment[]>(INITIAL_SHIPMENTS);
  
  // Selected shipment ID or 'OVERVIEW'
  const [selectedBookingId, setSelectedBookingId] = useState<string | 'OVERVIEW'>('BK-8930');
  
  // Terminal sub-tabs: signals vs kafka logs
  const [activeTab, setActiveTab] = useState<'signals' | 'kafka'>('signals');
  
  // Kafka logs
  const [kafkaLogs, setKafkaLogs] = useState<KafkaEvent[]>([]);

  // Cancellation Review Modal state
  const [cancellingShipment, setCancellingShipment] = useState<TrackedShipment | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Sync activeBookingId prop from QuotingConsole or external triggers
  useEffect(() => {
    if (!activeBookingId) return;

    setShipments((prev) => {
      const exists = prev.find((s) => s.bookingId === activeBookingId);
      if (exists) return prev;

      const newShipment: TrackedShipment = {
        bookingId: activeBookingId,
        origin: 'Mumbai Port DFC Gate-1',
        destination: 'Delhi ICD Terminal-3',
        commodity: 'General Consolidated Cargo',
        status: 'RESERVATION_INITIATED',
        stage: 'First-Mile Dispatch Ready',
        transitProgress: 5,
        uptimeSla: 'Normal',
        speedKmh: 0,
        signalSource: 'FOIS_Pravah_Live',
        heading: 'North-East',
        assignedWindowId: 'WIN-NEW-DISPATCH',
        currentCoordinates: { lat: 19.076, lng: 72.8777 },
        aqiMetrics: {
          aqi: 135,
          grapStage: 'STAGE_I_MODERATE',
          activeRestrictions: 'None',
          apiSource: 'Open-Meteo Air Quality',
        },
        route: ['Mumbai Port DFC Gate-1', 'Dadri ICD Gateway', 'Delhi ICD Terminal-3'],
        statusDescription: 'New booking confirmed. Container slot locked into upcoming line-haul departure.',
        isDelayed: false,
        isCancelled: false,
        totalBookingAmount: 14500,
        lastPing: new Date().toISOString(),
      };
      return [newShipment, ...prev];
    });

    setSelectedBookingId(activeBookingId);
  }, [activeBookingId]);

  // Poll real backend database / endpoint for live updates
  useEffect(() => {
    const fetchLiveShipments = async () => {
      try {
        const liveRecords: ShipmentTrackingRecord[] = await getAllShipmentsTracking();
        if (Array.isArray(liveRecords) && liveRecords.length > 0) {
          setShipments((prev) => {
            const updated = [...prev];
            for (const record of liveRecords) {
              const idx = updated.findIndex((s) => s.bookingId === record.booking_id);
              const isRerouted = record.status === 'REROUTED_GRAP_ACTIVE';
              const isDelivered = record.status === 'DELIVERED';
              const isCancelled = record.status === 'CANCELLED';

              const computedProgress = isDelivered
                ? 100
                : isCancelled
                ? 0
                : isRerouted
                ? 82
                : idx >= 0
                ? updated[idx].transitProgress
                : 65;

              const stageName = isDelivered
                ? 'Arrived & Verified'
                : isCancelled
                ? 'Cargo Cancelled'
                : isRerouted
                ? 'GRAP Reroute Active'
                : computedProgress < 30
                ? 'First-Mile Feeder Dispatch'
                : computedProgress > 85
                ? 'Last-Mile Urban Delivery'
                : 'Line-Haul DFC Transit';

              const shipmentObj: TrackedShipment = {
                bookingId: record.booking_id,
                origin: record.origin || 'Mumbai Port DFC Gate-1',
                destination: record.destination || 'Delhi ICD Terminal-3',
                commodity: record.commodity || (idx >= 0 ? updated[idx].commodity : 'Consolidated LCL Freight'),
                status: record.status || 'IN_TRANSIT',
                stage: stageName,
                transitProgress: computedProgress,
                uptimeSla: isCancelled
                  ? 'Saga Reversal Complete'
                  : isRerouted
                  ? 'Re-Route Split (+45m)'
                  : idx >= 0 && updated[idx].isDelayed
                  ? 'Violated (+2.4h)'
                  : 'Normal',
                speedKmh: record.telemetry?.speed_kmh || (isRerouted ? 38 : 55),
                signalSource: record.telemetry?.signal_source || 'FOIS_Pravah_Live',
                heading: record.telemetry?.heading || 'North-East',
                assignedWindowId: record.assigned_window_id || 'WIN-PRIMARY-DFC',
                currentCoordinates: record.telemetry?.current_coordinates || { lat: 22.84, lng: 74.52 },
                aqiMetrics: {
                  aqi: record.aqi_metrics?.aqi || 140,
                  grapStage: record.aqi_metrics?.grap_stage || 'STAGE_I_MODERATE',
                  activeRestrictions: record.aqi_metrics?.active_restrictions || 'None',
                  apiSource: record.aqi_metrics?.api_source || 'Open-Meteo Air Quality',
                },
                route: record.route || [record.origin, 'Dadri ICD Gateway', record.destination],
                statusDescription: record.status_description || 'Live multimodal freight rail transit.',
                isDelayed: idx >= 0 ? updated[idx].isDelayed : false,
                isCancelled: isCancelled || (idx >= 0 ? updated[idx].isCancelled : false),
                cancellationRefundAmount: idx >= 0 ? updated[idx].cancellationRefundAmount : null,
                totalBookingAmount: idx >= 0 ? updated[idx].totalBookingAmount : 16650,
                lastPing: record.telemetry?.last_ping || new Date().toISOString(),
              };

              if (idx >= 0) {
                updated[idx] = { ...updated[idx], ...shipmentObj };
              } else {
                updated.push(shipmentObj);
              }
            }
            return updated;
          });
        }
      } catch (err) {
        // Fallback to active local state if network poll fails
      }
    };

    fetchLiveShipments();
    const interval = setInterval(fetchLiveShipments, 6000);
    return () => clearInterval(interval);
  }, []);

  // Currently selected shipment object (if not OVERVIEW)
  const currentShipment: TrackedShipment = useMemo(() => {
    if (selectedBookingId === 'OVERVIEW') {
      return shipments[0] || INITIAL_SHIPMENTS[0];
    }
    return shipments.find((s) => s.bookingId === selectedBookingId) || shipments[0] || INITIAL_SHIPMENTS[0];
  }, [shipments, selectedBookingId]);

  // Sync Kafka logs on telemetry pings
  useEffect(() => {
    const time = () => new Date().toLocaleTimeString();
    const newLogs: KafkaEvent[] = shipments.slice(0, 3).map((s, idx) => ({
      timestamp: time(),
      bookingId: s.bookingId,
      partition: idx % 4,
      offset: Math.floor(Math.random() * 50000) + 120000,
      message: `[TELEMETRY] Lat ${s.currentCoordinates.lat}, Lng ${s.currentCoordinates.lng} • Speed: ${s.speedKmh} km/h • Signal: ${s.signalSource}`,
      severity: s.status === 'REROUTED_GRAP_ACTIVE' ? 'warn' : s.isCancelled ? 'error' : 'info',
    }));

    setKafkaLogs((prev) => [...newLogs, ...prev.slice(0, 18)]);
  }, [shipments]);

  // Per-Shipment Toggle Delay action
  const handleToggleDelay = useCallback((targetBookingId: string) => {
    setShipments((prev) =>
      prev.map((s) => {
        if (s.bookingId !== targetBookingId) return s;
        const newDelay = !s.isDelayed;
        return {
          ...s,
          isDelayed: newDelay,
          uptimeSla: newDelay ? 'Violated (+2.4h)' : s.status === 'REROUTED_GRAP_ACTIVE' ? 'Re-Route Split (+45m)' : 'Normal',
        };
      })
    );

    const time = () => new Date().toLocaleTimeString();
    setKafkaLogs((prev) => [
      {
        timestamp: time(),
        bookingId: targetBookingId,
        partition: 2,
        offset: 489201,
        message: `[SIMULATOR] Feeder delay event toggled for ${targetBookingId}. FOIS gateway fallback initiated.`,
        severity: 'warn',
      },
      ...prev,
    ]);
  }, []);

  // Per-Shipment Cancellation Confirmation execution
  const handleConfirmCancellation = useCallback(async (summary: CancellationRefundSummary) => {
    const targetBookingId = summary.bookingId;
    setIsCancelling(true);
    setActiveTab('kafka');

    try {
      // 1. Call backend API
      const res = await cancelFreight(targetBookingId);

      const time = () => new Date().toLocaleTimeString();
      setKafkaLogs((prev) => [
        {
          timestamp: time(),
          bookingId: targetBookingId,
          partition: 0,
          offset: 100,
          message: `[API] Cancellation accepted for ${targetBookingId}. Response: ${res.status}`,
          severity: 'info',
        },
        ...prev,
      ]);

      // 2. Publish operational event
      try {
        await publishOperationalEvent({
          eventType: 'CARGO_REJECTED',
          shipmentId: targetBookingId,
          operatorId: 'SHIPPER_PORTAL',
          location: summary.origin,
          timestamp: new Date().toISOString(),
          metadata: {
            cancellationReason: 'Shipper cancellation via review overlay',
            estimatedRefund: summary.estimatedRefund,
            deductions: summary.totalDeductions,
          },
        });
      } catch (err) {
        console.warn('[Tracking] Operational event error:', err);
      }

      // 3. Step-by-step Saga rollback logs
      await new Promise((resolve) => setTimeout(resolve, 500));
      setKafkaLogs((prev) => [
        {
          timestamp: time(),
          bookingId: targetBookingId,
          partition: 1,
          offset: 101,
          message: `[SAGA] [Step 1/3] [release_truck_hold] Released first-mile truck allocation for ${targetBookingId}.`,
          severity: 'warn',
        },
        ...prev,
      ]);

      await new Promise((resolve) => setTimeout(resolve, 500));
      setKafkaLogs((prev) => [
        {
          timestamp: time(),
          bookingId: targetBookingId,
          partition: 1,
          offset: 102,
          message: `[SAGA] [Step 2/3] [release_cto_slot] Released CTO container train wagon block for ${targetBookingId}.`,
          severity: 'warn',
        },
        ...prev,
      ]);

      await new Promise((resolve) => setTimeout(resolve, 500));
      setKafkaLogs((prev) => [
        {
          timestamp: time(),
          bookingId: targetBookingId,
          partition: 1,
          offset: 103,
          message: `[SAGA] [Step 3/3] [trigger_secondary_flash_auction] Re-auctioned released CBM capacity to Return Exchange queue.`,
          severity: 'success',
        },
        {
          timestamp: time(),
          bookingId: targetBookingId,
          partition: 0,
          offset: 104,
          message: `[SAGA] Rollback complete for ${targetBookingId}. Net refund ${formatINR(summary.estimatedRefund)} reversal queued.`,
          severity: 'success',
        },
        ...prev,
      ]);

      // 4. Update shipment state
      setShipments((prev) =>
        prev.map((s) => {
          if (s.bookingId !== targetBookingId) return s;
          return {
            ...s,
            isCancelled: true,
            status: 'CANCELLED',
            stage: 'Cargo Cancelled',
            transitProgress: 0,
            uptimeSla: 'Saga Reversal Complete',
            cancellationRefundAmount: summary.estimatedRefund,
          };
        })
      );

      setCancellingShipment(null);
    } catch (err: any) {
      console.error('[MultiSignalTracker] Cancellation failed:', err);
      throw err;
    } finally {
      setIsCancelling(false);
    }
  }, []);

  // Compute Signal Health Confidence Badge per selected shipment
  const confidenceBadge = useMemo(() => {
    const s = currentShipment;
    if (s.isCancelled) {
      return {
        label: 'CANCELLED_REFUND_INITIATED',
        style: 'bg-rose-950/40 text-rose-400 border-rose-800/80 shadow-[0_0_8px_rgba(244,63,94,0.15)]',
        desc: `Booking cancelled. Saga rollback completed; refund of ${formatINR(s.cancellationRefundAmount || 11250)} dispatched to source SME account.`,
      };
    }

    if (s.isDelayed) {
      return {
        label: 'NTES_FALLBACK (70%)',
        style: 'bg-amber-950/40 text-amber-400 border-amber-800/80 shadow-[0_0_8px_rgba(245,158,11,0.15)]',
        desc: 'FOIS feed offline. Fusing NTES schedule updates with degraded confidence metrics.',
      };
    }

    if (s.status === 'REROUTED_GRAP_ACTIVE') {
      return {
        label: 'GRAP_STAGE_3_REROUTE (88%)',
        style: 'bg-[#FF6B00]/10 text-[#FF6B00] border-[#FF6B00]/30 shadow-[0_0_8px_rgba(255,107,0,0.15)]',
        desc: 'Severe AQI alert in NCR. Fleet rerouted to avoid heavy diesel vehicle municipal entry restrictions.',
      };
    }

    if (s.transitProgress >= 100 || s.status === 'DELIVERED') {
      return {
        label: 'LOCAL_VERIFIED_SIGNAL (99%)',
        style: 'bg-blue-950/40 text-blue-400 border-blue-800/80 shadow-[0_0_8px_rgba(59,130,246,0.15)]',
        desc: 'Final delivery checklist verified locally. Signal confirmed at Last-Mile destination gate.',
      };
    }

    return {
      label: 'DFC_LIVE (95%)',
      style: 'bg-emerald-950/40 text-emerald-400 border-emerald-800/80 shadow-[0_0_8px_rgba(16,185,129,0.15)]',
      desc: 'All signal layers online. Multi-source location coordinates fully synchronized.',
    };
  }, [currentShipment]);

  // Scoped Telemetry Signals for selected shipment or combined overview
  const signals = useMemo<TelemetrySignal[]>(() => {
    const s = currentShipment;
    if (s.isCancelled) {
      return [
        {
          layer: 'FOIS Pravah API',
          source: 'Indian Railways Central Gateway',
          value: 'Slot allocation revoked • Train schedule released',
          status: 'offline',
          latencyMs: 12,
        },
        {
          layer: 'Temporal Saga Gateway',
          source: 'Lonics Reversal Orchestrator',
          value: `Rollback completed • Refund ${formatINR(s.cancellationRefundAmount || 11250)} dispatched`,
          status: 'active',
          latencyMs: 8,
        },
        {
          layer: 'Return Exchange Node',
          source: 'Container Positioning Engine',
          value: 'Released capacity transferred to secondary spot backhaul queue',
          status: 'active',
          latencyMs: 15,
        },
        {
          layer: 'Ground Ops Terminal',
          source: 'Gate manifest controller',
          value: 'Manifest record updated: CANCELLED (Carrier release verified)',
          status: 'active',
          latencyMs: 10,
        },
      ];
    }

    return [
      {
        layer: 'FOIS Pravah API',
        source: 'Indian Railways Central Gateway',
        value: `GPS Resolved: Lat ${s.currentCoordinates.lat}, Lng ${s.currentCoordinates.lng} • Velocity: ${s.speedKmh} km/h`,
        status: s.status === 'REROUTED_GRAP_ACTIVE' ? 'fallback' : 'active',
        latencyMs: 35,
      },
      {
        layer: 'AQI Metric Engine',
        source: 'Open-Meteo Air Quality Live Feed',
        value: `AQI: ${s.aqiMetrics.aqi} (${s.aqiMetrics.grapStage}) • Source: ${s.aqiMetrics.apiSource}`,
        status: s.status === 'REROUTED_GRAP_ACTIVE' ? 'fallback' : 'active',
        latencyMs: 82,
      },
      {
        layer: 'Active Route Sequence',
        source: 'OSRM Dynamic Coordinates',
        value: s.route.join(' ➔ '),
        status: 'active',
        latencyMs: 15,
      },
      {
        layer: 'Ground Ops Telemetry',
        source: 'Gate manifest controller',
        value: `Status: ${s.status} • Window Cache: ${s.assignedWindowId}`,
        status: s.status === 'DELIVERED' ? 'active' : 'fallback',
        latencyMs: 12,
      },
    ];
  }, [currentShipment]);

  return (
    <div className="bg-card/45 border border-slate-200 dark:border-zinc-800 backdrop-blur-md rounded-xl p-3.5 sm:p-4 shadow-xl space-y-3 text-foreground">
      {/* Header with Title & Shipment Selector */}
      <div className="space-y-2 border-b border-slate-200 dark:border-zinc-800 pb-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="p-1 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
              <Radio className="h-3.5 w-3.5 animate-pulse" />
            </span>
            <h2 className="font-bold text-sm sm:text-base text-foreground tracking-tight">
              Multi-Signal Tracking Terminal
            </h2>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-primary/10 text-primary border border-primary/20 shrink-0">
            {shipments.length} Active
          </span>
        </div>

        {/* Compact Shipment Selector Ribbon */}
        <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg border border-slate-200 dark:border-zinc-800 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-zinc-700">
          <button
            type="button"
            id="tracking-tab-overview"
            onClick={() => setSelectedBookingId('OVERVIEW')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-medium transition cursor-pointer flex items-center gap-1 shrink-0 ${
              selectedBookingId === 'OVERVIEW'
                ? 'bg-card text-primary shadow-sm font-bold border border-border'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <LayoutGrid className="h-3 w-3" />
            <span>Overview</span>
          </button>

          {shipments.map((s) => {
            const isSelected = selectedBookingId === s.bookingId;
            const shortOrigin = s.origin.split(' ')[0].substring(0, 3).toUpperCase();
            const shortDest = s.destination.split(' ')[0].substring(0, 3).toUpperCase();
            return (
              <button
                key={s.bookingId}
                type="button"
                id={`tracking-tab-${s.bookingId}`}
                onClick={() => setSelectedBookingId(s.bookingId)}
                className={`px-2 py-1 rounded-md text-[11px] font-mono font-medium transition cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? 'bg-card text-primary shadow-sm font-bold border border-border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    s.isCancelled
                      ? 'bg-rose-500'
                      : s.status === 'REROUTED_GRAP_ACTIVE'
                      ? 'bg-[#FF6B00] animate-pulse'
                      : 'bg-emerald-500 animate-pulse'
                  }`}
                />
                <span className="font-semibold">{s.bookingId}</span>
                <span className="text-[9px] text-muted-foreground opacity-75 hidden sm:inline">
                  ({shortOrigin}➔{shortDest})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── VIEW MODE 1: FLEET OVERVIEW ── */}
      {selectedBookingId === 'OVERVIEW' && (
        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-0.5 animate-fade-in scrollbar-thin">
          <div className="flex justify-between items-center text-[11px] font-mono text-muted-foreground pb-0.5">
            <span className="font-bold uppercase flex items-center gap-1 text-foreground">
              <Layers className="h-3 w-3 text-primary" /> Active Freight Matrix
            </span>
            <span>{shipments.length} Corridors</span>
          </div>

          <div className="space-y-2">
            {shipments.map((shipment) => (
              <div
                key={shipment.bookingId}
                className="p-2.5 bg-background border border-slate-200 dark:border-zinc-800 rounded-lg space-y-2 hover:border-primary/40 transition shadow-sm"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono">
                    <span className="font-bold text-foreground">{shipment.bookingId}</span>
                    <span className="text-muted-foreground">({shipment.origin.split(' ')[0]} ➔ {shipment.destination.split(' ')[0]})</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-1.5 py-0.2 rounded text-[8px] font-mono font-bold uppercase border ${
                        shipment.isCancelled
                          ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                          : shipment.status === 'REROUTED_GRAP_ACTIVE'
                          ? 'bg-[#FF6B00]/10 text-[#FF6B00] border-[#FF6B00]/30'
                          : 'bg-primary/10 text-primary border-primary/20'
                      }`}
                    >
                      {shipment.stage}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedBookingId(shipment.bookingId)}
                      className="px-1.5 py-0.5 text-[9px] font-mono font-semibold bg-muted hover:bg-muted/80 text-foreground rounded border border-border transition cursor-pointer"
                    >
                      Inspect →
                    </button>
                  </div>
                </div>

                <div className="relative h-1.5 w-full bg-muted/60 rounded-full overflow-hidden border border-border">
                  <div
                    className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${
                      shipment.isCancelled
                        ? 'from-rose-600 to-rose-400'
                        : shipment.isDelayed
                        ? 'from-rose-600 to-rose-500'
                        : shipment.status === 'REROUTED_GRAP_ACTIVE'
                        ? 'from-primary via-[#FF6B00] to-amber-500'
                        : 'from-primary to-blue-500'
                    }`}
                    style={{ width: `${shipment.transitProgress}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[9px] font-mono text-muted-foreground">
                  <span>{shipment.transitProgress}% • {shipment.speedKmh} km/h</span>
                  <span className={shipment.isDelayed ? 'text-rose-500 font-bold' : ''}>SLA: {shipment.uptimeSla}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── VIEW MODE 2: SINGLE SHIPMENT VIEW ── */}
      {selectedBookingId !== 'OVERVIEW' && (
        <div className="space-y-2.5 animate-fade-in">
          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              id="tracking-delay-feeder-btn"
              disabled={currentShipment.isCancelled}
              onClick={() => handleToggleDelay(currentShipment.bookingId)}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition border cursor-pointer ${
                currentShipment.isCancelled
                  ? 'bg-muted border-border text-muted-foreground cursor-not-allowed opacity-50'
                  : currentShipment.isDelayed
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-rose-500/20'
                  : 'bg-background border-border text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {currentShipment.isDelayed ? (
                <RefreshCw className="h-3 w-3 text-rose-500 animate-spin" />
              ) : (
                <AlertTriangle className="h-3 w-3" />
              )}
              <span>{currentShipment.isDelayed ? 'FOIS Offline' : 'Delay Feeder'}</span>
            </button>

            <button
              type="button"
              id="tracking-cancel-cargo-btn"
              disabled={currentShipment.isCancelled || isCancelling}
              onClick={() => setCancellingShipment(currentShipment)}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition border cursor-pointer ${
                currentShipment.isCancelled
                  ? 'bg-muted border-border text-muted-foreground cursor-not-allowed opacity-60'
                  : isCancelling
                  ? 'bg-background border-border text-muted-foreground cursor-not-allowed'
                  : 'bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-500'
              }`}
            >
              {isCancelling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : currentShipment.isCancelled ? (
                <Ban className="h-3 w-3 text-rose-500" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{currentShipment.isCancelled ? 'Cancelled' : isCancelling ? 'Processing...' : 'Cancel Cargo'}</span>
            </button>
          </div>

          {/* Post-Cancellation Status Banner */}
          {currentShipment.isCancelled && (
            <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-[10px] text-rose-600 dark:text-rose-400 flex items-center justify-between gap-1 animate-fade-in">
              <span className="font-bold flex items-center gap-1">
                <Ban className="h-3 w-3" /> {currentShipment.bookingId} Cancelled
              </span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                Refund: {formatINR(currentShipment.cancellationRefundAmount || 11250)}
              </span>
            </div>
          )}

          {/* Compact Transit Visual Pipeline */}
          <div className="bg-background/80 border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 space-y-2 shadow-inner">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 min-w-0 text-[11px] font-semibold text-foreground">
                <span className="truncate max-w-[120px]">{currentShipment.origin.split(' ')[0]}</span>
                <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                <span className="truncate max-w-[120px]">{currentShipment.destination.split(' ')[0]}</span>
              </div>

              <span
                className={`shrink-0 font-bold font-mono text-center px-1.5 py-0.2 rounded text-[9px] tracking-wider uppercase border ${
                  currentShipment.isCancelled
                    ? 'text-rose-500 bg-rose-500/10 border-rose-500/30'
                    : currentShipment.isDelayed
                    ? 'text-rose-500 bg-rose-500/10 border-rose-500/30'
                    : currentShipment.status === 'REROUTED_GRAP_ACTIVE'
                    ? 'text-[#FF6B00] animate-pulse bg-[#FF6B00]/10 border-[#FF6B00]/30'
                    : 'text-primary bg-primary/10 border-primary/20'
                }`}
              >
                {currentShipment.isCancelled
                  ? 'CANCELED'
                  : currentShipment.isDelayed
                  ? 'STALLED'
                  : currentShipment.status === 'REROUTED_GRAP_ACTIVE'
                  ? 'GRAP REROUTE'
                  : currentShipment.stage.toUpperCase()}
              </span>
            </div>

            <div className="relative h-2 w-full bg-muted/60 rounded-full border border-border">
              <div
                className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${
                  currentShipment.isCancelled
                    ? 'from-rose-600 to-rose-400'
                    : currentShipment.isDelayed
                    ? 'from-rose-600 to-rose-500'
                    : currentShipment.status === 'REROUTED_GRAP_ACTIVE'
                    ? 'from-primary via-[#FF6B00] to-amber-500'
                    : 'from-primary to-blue-500'
                }`}
                style={{ width: `${currentShipment.transitProgress}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border flex items-center justify-center transition-all duration-500 shadow-sm bg-primary/20 border-primary"
                style={{ left: `calc(${Math.max(2, Math.min(98, currentShipment.transitProgress))}% - 7px)` }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              </div>
            </div>

            <div className="flex justify-between items-center text-[9px] text-muted-foreground font-mono">
              <span>Progress: <strong className="text-foreground">{currentShipment.transitProgress.toFixed(1)}%</strong></span>
              <span>SLA: <strong className={currentShipment.isDelayed ? 'text-rose-500' : 'text-foreground'}>{currentShipment.uptimeSla}</strong></span>
            </div>
          </div>

          {/* Compact Signal Health Confidence Pill */}
          <div className={`p-2 border rounded-lg flex items-center justify-between text-xs transition-all duration-300 ${confidenceBadge.style}`}>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse shrink-0" />
              <span className="font-bold font-mono text-[10px] tracking-wider">{confidenceBadge.label}</span>
            </div>
            <span className="text-[9px] opacity-80 truncate max-w-[170px]">{confidenceBadge.desc}</span>
          </div>
        </div>
      )}

      {/* ── SHARED TELEMETRY CHANNELS & KAFKA RETRY FEED ── */}
      <div className="space-y-2 pt-0.5">
        <div className="flex border-b border-slate-200 dark:border-zinc-800 text-[11px]">
          <button
            type="button"
            className={`px-3 py-1.5 font-semibold border-b-2 cursor-pointer transition ${
              activeTab === 'signals'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('signals')}
          >
            Telemetry Channels
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 font-semibold border-b-2 cursor-pointer transition flex items-center gap-1 ${
              activeTab === 'kafka'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('kafka')}
          >
            <Terminal className="h-3 w-3" /> Kafka Queue
            {currentShipment.isDelayed && <span className="h-1 w-1 rounded-full bg-rose-500 animate-pulse" />}
          </button>
        </div>

        {/* Compact Signals Grid */}
        {activeTab === 'signals' && (
          <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-0.5 scrollbar-thin">
            {signals.map((sig, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center bg-background border border-slate-200 dark:border-zinc-800 p-1.5 px-2 rounded-md text-[10px] animate-fade-in"
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1 font-semibold text-foreground truncate">
                    {sig.status === 'active' && <Wifi className="h-3 w-3 text-emerald-500 shrink-0" />}
                    {sig.status === 'fallback' && <Wifi className="h-3 w-3 text-amber-500 animate-pulse shrink-0" />}
                    {sig.status === 'offline' && <WifiOff className="h-3 w-3 text-rose-500 shrink-0" />}
                    <span className="truncate">{sig.layer}:</span>
                    <span className="font-mono text-muted-foreground truncate">{sig.value}</span>
                  </div>
                </div>
                <span className="font-mono text-[9px] text-muted-foreground shrink-0">{sig.latencyMs}ms</span>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: Kafka Feed */}
        {activeTab === 'kafka' && (
          <KafkaQueueFeed
            kafkaLogs={kafkaLogs}
            selectedId={selectedBookingId === 'OVERVIEW' ? null : selectedBookingId}
          />
        )}
      </div>

      {/* Terminal Footer */}
      <div className="border-t border-slate-200 dark:border-zinc-800 pt-2 flex justify-between items-center text-[9px] font-mono text-muted-foreground">
        <span className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3 text-emerald-500" /> ULIP Gateway Online
        </span>
        <span>
          Selected: {selectedBookingId === 'OVERVIEW' ? 'Fleet Overview' : selectedBookingId}
        </span>
      </div>

      {/* Per-Shipment Cancellation & Refund Review Modal */}
      {cancellingShipment && (
        <CancellationReviewModal
          isOpen={true}
          onClose={() => setCancellingShipment(null)}
          bookingId={cancellingShipment.bookingId}
          origin={cancellingShipment.origin}
          destination={cancellingShipment.destination}
          totalBookingAmount={cancellingShipment.totalBookingAmount}
          currentStatus={cancellingShipment.status}
          transitProgress={cancellingShipment.transitProgress}
          onConfirmCancellation={handleConfirmCancellation}
        />
      )}
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
