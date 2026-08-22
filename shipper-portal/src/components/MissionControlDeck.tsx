import { useState, useMemo, useEffect, useCallback } from 'react';
import type {
  AgentId,
  AgentState,
  AgentLink,
} from '../types/agent-matrix';
import {
  ShieldAlert,
  Activity,
  CheckCircle,
  Clock,
  Layers,
  Network,
  ListTodo,
  Calculator,
  Compass,
  ChevronUp,
  ChevronDown,
  Moon,
  Sun,
  LogOut,
  Building2,
  Train,
  Brain,
} from 'lucide-react';
import QuotingConsole from './QuotingConsole';
import MultiSignalTracker from './MultiSignalTracker';
import ConsolidationMonitor from './ConsolidationMonitor';
import MonthlyBillingPanel from './MonthlyBillingPanel';
import RailContainerBookingModal from './rail/RailContainerBookingModal';
import AIPredictionDashboard from './AIPredictionDashboard';
import { motion, AnimatePresence } from 'framer-motion';
import type { UserProfile } from '../lib/supabase';

const AGENT_LIST: { id: AgentId; name: string; desc: string; capabilities: string[] }[] = [
  {
    id: 'CONSOLIDATION_AGENT',
    name: 'Consolidation Agent',
    desc: 'Manages LCL packing windows using dual CBM + KG threshold boundaries.',
    capabilities: ['CBM Matching', 'KG Threshold Check', 'Space Allocation'],
  },
  {
    id: 'COMPATIBILITY_GUARD',
    name: 'Compatibility Guard',
    desc: 'Enforces chemical, smell, and damage risk matrices across co-loaded cargo.',
    capabilities: ['Co-load Safety Check', 'Contamination Prevention', 'Corrosive Isolation'],
  },
  {
    id: 'DIM_WEIGHT_PRICING',
    name: 'Dim Weight Pricing',
    desc: 'Dynamically computes chargeable weight thresholds based on density factors.',
    capabilities: ['Density Calculation', 'Volumetric Billing', 'Dimension Check'],
  },
  {
    id: 'DUAL_BRAIN_PRICING',
    name: 'Dual Brain Pricing',
    desc: 'Simultaneously queries contracted wholesale rail vs spot market road shadow prices.',
    capabilities: ['Spot Road Lookup', 'Rail Surcharge Check', 'Arbitrage Calculation'],
  },
  {
    id: 'RISK_GATE_AGENT',
    name: 'Risk Gate Agent',
    desc: 'Computes Transporter Reliability Scores (TRS) using active FASTag tracking histories.',
    capabilities: ['FASTag Analytics', 'Transporter Scorecarding', 'Fraud Mitigation'],
  },
  {
    id: 'MULTIMODAL_CONDUCTOR',
    name: 'Multimodal Conductor',
    desc: 'Coordinates operational handoffs between First-Mile, Line-Haul, and Last-Mile loops.',
    capabilities: ['First-Mile Routing', 'Line-Haul Schedule Sync', 'Last-Mile Delivery'],
  },
  {
    id: 'HYBRID_TRACKING_API',
    name: 'Hybrid Tracking API',
    desc: 'Fuses multi-source location signals (CRIS Pravah API, NTES, CTO feeds, and manual OCR entries).',
    capabilities: ['Pravah API Sync', 'NTES Fallback Engine', 'CTO Feed Integration'],
  },
  {
    id: 'TRAJECTORY_PREDICTOR',
    name: 'Trajectory Predictor',
    desc: 'Runs 120-minute advance geofence predictions for approaching border checkpoints.',
    capabilities: ['Geofence Predictions', 'ETA Calibration', 'Congestion Forecasting'],
  },
  {
    id: 'URBAN_ROUTING_AGENT',
    name: 'Urban Routing Agent',
    desc: 'Automatically triggers delivery volume splits into e-LCV fleets during municipal bans.',
    capabilities: ['Municipal Ban Detection', 'Fleet Splitting', 'e-LCV Routing'],
  },
  {
    id: 'COMPLIANCE_NODE',
    name: 'Compliance Node',
    desc: 'Executes real-time e-Way Bill Part B updates via automated ULIP gateway requests.',
    capabilities: ['ULIP Integration', 'e-Way Bill Automation', 'Part B Updates'],
  },
  {
    id: 'RETURN_EXCHANGE_NODE',
    name: 'Return Exchange Node',
    desc: 'Computes Container Positioning Scores (CPS) and triggers discounted backhaul spot sales.',
    capabilities: ['CPS Modeling', 'Backhaul Selling', 'Container Logistics'],
  },
];

// Initialize Mock Telemetry data for all 11 agents
const INITIAL_AGENTS: Record<AgentId, AgentState> = {
  CONSOLIDATION_AGENT: {
    id: 'CONSOLIDATION_AGENT',
    name: 'Consolidation Agent',
    status: 'working',
    lastActive: new Date().toISOString(),
    metadata: {
      description: 'Manages LCL packing windows using dual CBM + KG threshold boundaries.',
      version: '1.2.0',
      capabilities: ['CBM Matching', 'KG Threshold Check'],
    },
    metrics: {
      cpuUsagePercent: 32,
      memoryUsageMb: 124,
      messagesProcessed: 1450,
      averageLatencyMs: 45,
      uptimeSeconds: 86400,
      successRate: 0.99,
    },
    currentTask: {
      id: 'task-con-94',
      description: 'Calculating LCL co-load layout on container #CON-2026-90',
      startedAt: new Date().toISOString(),
      progressPercent: 78,
    },
    errors: [],
  },
  COMPATIBILITY_GUARD: {
    id: 'COMPATIBILITY_GUARD',
    name: 'Compatibility Guard',
    status: 'success',
    lastActive: new Date().toISOString(),
    metadata: {
      description: 'Enforces cargo safety risk matrices.',
      version: '1.1.2',
      capabilities: ['Co-load Safety Check'],
    },
    metrics: {
      cpuUsagePercent: 12,
      memoryUsageMb: 89,
      messagesProcessed: 320,
      averageLatencyMs: 12,
      uptimeSeconds: 86400,
      successRate: 1.0,
    },
    errors: [],
  },
  DIM_WEIGHT_PRICING: {
    id: 'DIM_WEIGHT_PRICING',
    name: 'Dim Weight Pricing',
    status: 'working',
    lastActive: new Date().toISOString(),
    metadata: {
      description: 'Computes chargeable weight.',
      version: '2.0.4',
      capabilities: ['Density Calculation', 'Volumetric Billing'],
    },
    metrics: {
      cpuUsagePercent: 48,
      memoryUsageMb: 142,
      messagesProcessed: 890,
      averageLatencyMs: 10,
      uptimeSeconds: 86400,
      successRate: 0.995,
    },
    currentTask: {
      id: 'task-dim-102',
      description: 'Recalculating chargable volumetric weight based on AI scan parameters',
      startedAt: new Date().toISOString(),
      progressPercent: 100,
    },
    errors: [],
  },
  DUAL_BRAIN_PRICING: {
    id: 'DUAL_BRAIN_PRICING',
    name: 'Dual Brain Pricing',
    status: 'idle',
    lastActive: new Date().toISOString(),
    metadata: {
      description: 'Simultaneously queries rail vs road spot rates.',
      version: '1.4.1',
      capabilities: ['Spot Road Lookup', 'Arbitrage Calculation'],
    },
    metrics: {
      cpuUsagePercent: 15,
      memoryUsageMb: 110,
      messagesProcessed: 1205,
      averageLatencyMs: 85,
      uptimeSeconds: 86400,
      successRate: 0.988,
    },
    errors: [],
  },
  RISK_GATE_AGENT: {
    id: 'RISK_GATE_AGENT',
    name: 'Risk Gate Agent',
    status: 'success',
    lastActive: new Date().toISOString(),
    metadata: {
      description: 'Computes Transporter Reliability Scores (TRS).',
      version: '1.0.1',
      capabilities: ['FASTag Analytics', 'Transporter Scorecarding'],
    },
    metrics: {
      cpuUsagePercent: 8,
      memoryUsageMb: 76,
      messagesProcessed: 560,
      averageLatencyMs: 15,
      uptimeSeconds: 86400,
      successRate: 1.0,
    },
    errors: [],
  },
  MULTIMODAL_CONDUCTOR: {
    id: 'MULTIMODAL_CONDUCTOR',
    name: 'Multimodal Conductor',
    status: 'working',
    lastActive: new Date().toISOString(),
    metadata: {
      description: 'Coordinates operational handoffs between First-Mile, Line-Haul, and Last-Mile.',
      version: '2.1.0',
      capabilities: ['Line-Haul Sync', 'Handoff Operations'],
    },
    metrics: {
      cpuUsagePercent: 45,
      memoryUsageMb: 210,
      messagesProcessed: 14200,
      averageLatencyMs: 40,
      uptimeSeconds: 86400,
      successRate: 0.999,
    },
    currentTask: {
      id: 'task-conductor-82',
      description: 'Syncing truck arrival at Mumbai rail depot for co-loaded container #CON-2026-90',
      startedAt: new Date().toISOString(),
      progressPercent: 65,
    },
    errors: [],
  },
  HYBRID_TRACKING_API: {
    id: 'HYBRID_TRACKING_API',
    name: 'Hybrid Tracking API',
    status: 'failed',
    lastActive: new Date().toISOString(),
    metadata: {
      description: 'Fuses location signals (Pravah API, NTES, CTO feeds, OCR).',
      version: '1.2.3',
      capabilities: ['Pravah API Sync', 'NTES Fallback Engine'],
    },
    metrics: {
      cpuUsagePercent: 55,
      memoryUsageMb: 198,
      messagesProcessed: 88,
      averageLatencyMs: 3500,
      uptimeSeconds: 86400,
      successRate: 0.89,
    },
    errors: [
      {
        id: 'err-tracking-12',
        code: 'FOIS_CONNECTION_TIMEOUT',
        message: 'FOIS API Connection failed: Connection pool exhausted. Fusing NTES Station updates.',
        timestamp: new Date().toISOString(),
        fatal: false,
      },
    ],
  },
  TRAJECTORY_PREDICTOR: {
    id: 'TRAJECTORY_PREDICTOR',
    name: 'Trajectory Predictor',
    status: 'idle',
    lastActive: new Date().toISOString(),
    metadata: {
      description: 'Runs advance geofence predictions.',
      version: '1.0.0',
      capabilities: ['Geofence Predictions', 'ETA Calibration'],
    },
    metrics: {
      cpuUsagePercent: 2,
      memoryUsageMb: 65,
      messagesProcessed: 430,
      averageLatencyMs: 95,
      uptimeSeconds: 86400,
      successRate: 0.992,
    },
    errors: [],
  },
  URBAN_ROUTING_AGENT: {
    id: 'URBAN_ROUTING_AGENT',
    name: 'Urban Routing Agent',
    status: 'working',
    lastActive: new Date().toISOString(),
    metadata: {
      description: 'Triggers splits to e-LCV fleets.',
      version: '1.3.0',
      capabilities: ['Municipal Ban Detection', 'Fleet Splitting'],
    },
    metrics: {
      cpuUsagePercent: 28,
      memoryUsageMb: 134,
      messagesProcessed: 720,
      averageLatencyMs: 25,
      uptimeSeconds: 86400,
      successRate: 0.998,
    },
    currentTask: {
      id: 'task-urban-921',
      description: 'Executing fleet allocation split at Delhi city gate (municipal ban active)',
      startedAt: new Date().toISOString(),
      progressPercent: 45,
    },
    errors: [],
  },
  COMPLIANCE_NODE: {
    id: 'COMPLIANCE_NODE',
    name: 'Compliance Node',
    status: 'idle',
    lastActive: new Date().toISOString(),
    metadata: {
      description: 'Executes e-Way Bill Part B updates via automated ULIP requests.',
      version: '1.0.0',
      capabilities: ['ULIP Integration', 'e-Way Bill Updates'],
    },
    metrics: {
      cpuUsagePercent: 1,
      memoryUsageMb: 58,
      messagesProcessed: 350,
      averageLatencyMs: 140,
      uptimeSeconds: 86400,
      successRate: 0.997,
    },
    errors: [],
  },
  RETURN_EXCHANGE_NODE: {
    id: 'RETURN_EXCHANGE_NODE',
    name: 'Return Exchange Node',
    status: 'paused',
    lastActive: new Date().toISOString(),
    metadata: {
      description: 'Computes CPS and backhaul sales.',
      version: '1.5.0',
      capabilities: ['CPS Modeling', 'Backhaul Selling'],
    },
    metrics: {
      cpuUsagePercent: 0,
      memoryUsageMb: 52,
      messagesProcessed: 120,
      averageLatencyMs: 0,
      uptimeSeconds: 86400,
      successRate: 0.995,
    },
    errors: [],
  },
};

// Generate initial mock grid links for the 11 updated operational layers
const generateMockLinks = (): Record<AgentId, Record<AgentId, AgentLink>> => {
  const links: Record<AgentId, Record<AgentId, AgentLink>> = {} as any;
  for (const src of AGENT_LIST) {
    links[src.id] = {} as any;
    for (const tgt of AGENT_LIST) {
      let status: 'inactive' | 'connected' | 'transmitting' | 'blocked' | 'error' = 'inactive';
      let bandwidth = 0;
      let errorRate = 0;
      let msgs = 0;

      if (src.id === tgt.id) {
        status = 'connected';
      } else {
        const connectedFlows: Record<string, string[]> = {
          CONSOLIDATION_AGENT: ['COMPATIBILITY_GUARD', 'DIM_WEIGHT_PRICING'],
          COMPATIBILITY_GUARD: ['MULTIMODAL_CONDUCTOR'],
          DIM_WEIGHT_PRICING: ['DUAL_BRAIN_PRICING'],
          DUAL_BRAIN_PRICING: ['COMPLIANCE_NODE'],
          RISK_GATE_AGENT: ['MULTIMODAL_CONDUCTOR'],
          MULTIMODAL_CONDUCTOR: ['HYBRID_TRACKING_API', 'TRAJECTORY_PREDICTOR'],
          HYBRID_TRACKING_API: ['URBAN_ROUTING_AGENT', 'COMPLIANCE_NODE'],
          TRAJECTORY_PREDICTOR: ['URBAN_ROUTING_AGENT'],
          URBAN_ROUTING_AGENT: ['COMPLIANCE_NODE'],
          COMPLIANCE_NODE: ['RETURN_EXCHANGE_NODE'],
          RETURN_EXCHANGE_NODE: [],
        };

        if (connectedFlows[src.id]?.includes(tgt.id)) {
          if (src.id === 'HYBRID_TRACKING_API') {
            status = 'error';
            bandwidth = 0;
            errorRate = 0.92;
          } else {
            status = Math.random() > 0.4 ? 'transmitting' : 'connected';
            bandwidth = Math.floor(Math.random() * 800) + 128;
            errorRate = Math.random() * 0.01;
          }
          msgs = Math.floor(Math.random() * 200) + 5;
        }
      }

      links[src.id][tgt.id] = {
        source: src.id,
        target: tgt.id,
        status,
        bandwidthKbps: bandwidth,
        errorRate,
        messagesTransmitted: msgs,
        lastTransmissionTime: status === 'transmitting' ? new Date().toISOString() : undefined,
      };
    }
  }
  return links;
};

interface MissionControlDeckProps {
  userProfile?: UserProfile | null;
  onSignOut?: () => void;
  onNavigateLanding?: () => void;
}

export default function MissionControlDeck({
  userProfile,
  onSignOut,
  onNavigateLanding: _onNavigateLanding,
}: MissionControlDeckProps = {}) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isDiagnosticsExpanded, setIsDiagnosticsExpanded] = useState(false);
  const [isRailBookingModalOpen, setIsRailBookingModalOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleOpenRail = () => setIsRailBookingModalOpen(true);
    const handleOpenRoad = () => {
      setActiveTab('Book');
      window.dispatchEvent(new CustomEvent('lonics:set-road-transport'));
    };

    window.addEventListener('lonics:open-rail-booking', handleOpenRail);
    window.addEventListener('lonics:open-road-booking', handleOpenRoad);

    return () => {
      window.removeEventListener('lonics:open-rail-booking', handleOpenRail);
      window.removeEventListener('lonics:open-road-booking', handleOpenRoad);
    };
  }, []);

  const [agents, setAgents] = useState<Record<AgentId, AgentState>>(INITIAL_AGENTS);
  const [links] = useState<Record<AgentId, Record<AgentId, AgentLink>>>(generateMockLinks);
  const [selectedAgentId, setSelectedAgentId] = useState<AgentId>('CONSOLIDATION_AGENT');
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'Book' | 'Track' | 'Monitor' | 'Predict'>('Book');
  const [showPredictionStudio, setShowPredictionStudio] = useState(false);

  const handleBookingCreated = useCallback((res: any) => {
    setActiveBookingId(res.booking_id);
    setActiveTab('Track');
  }, []);

  const activeAgent = useMemo(() => agents[selectedAgentId], [agents, selectedAgentId]);

  const metricsSummary = useMemo(() => {
    let active = 0;
    let errors = 0;
    let latencyTotal = 0;
    let counts = 0;

    Object.values(agents).forEach((a) => {
      if (a.status === 'working') active++;
      errors += a.errors.length;
      latencyTotal += a.metrics.averageLatencyMs;
      if (a.metrics.averageLatencyMs > 0) counts++;
    });

    return {
      activeTasks: active,
      totalErrors: errors,
      averageLatency: counts > 0 ? Math.round(latencyTotal / counts) : 0,
      systemUptime: '99.98%',
    };
  }, [agents]);

  // Handle manual status toggle
  const handleStatusChange = (id: AgentId, status: typeof INITIAL_AGENTS[AgentId]['status']) => {
    setAgents((prev) => {
      const copy = { ...prev };
      copy[id] = {
        ...copy[id],
        status,
        lastActive: new Date().toISOString(),
      };
      return copy;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'working':
        return 'text-blue-400 bg-blue-950/40 border-blue-800/80';
      case 'idle':
        return 'text-slate-400 bg-slate-900/40 border-slate-200 dark:border-zinc-800';
      case 'waiting':
        return 'text-amber-400 bg-amber-950/40 border-amber-800/80';
      case 'success':
        return 'text-emerald-400 bg-emerald-950/40 border-emerald-800/80';
      case 'failed':
        return 'text-rose-400 bg-rose-950/40 border-rose-800/80';
      case 'paused':
        return 'text-primary bg-primary/10 border-primary/30';
      default:
        return 'text-slate-400 bg-slate-900 border-slate-200 dark:border-zinc-800';
    }
  };

  const getLinkStatusColor = (status: string) => {
    switch (status) {
      case 'transmitting':
        return 'bg-primary shadow-[0_0_8px_var(--color-primary)]';
      case 'connected':
        return 'bg-emerald-500/80';
      case 'blocked':
        return 'bg-amber-500 shadow-[0_0_6px_#f59e0b]';
      case 'error':
        return 'bg-rose-500 shadow-[0_0_8px_#f43f5e]';
      default:
        return 'bg-slate-800/40';
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-4 md:p-6 selection:bg-primary/30 transition-colors duration-300">
      <div className="max-w-[1700px] mx-auto space-y-6">

        {/* Navigation / Header */}
        <header className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-200 dark:border-zinc-800 pb-4">
          {/* Left: Brand */}
          <div className="flex items-center gap-3">
            <img
              src="/lonicslogo.png"
              alt="Lonics"
              className="h-10 w-10 object-contain rounded-xl shadow-sm flex-shrink-0"
            />
            <span className="text-[26px] font-bold tracking-tight text-foreground font-sans leading-none">
              Lonics
            </span>
          </div>

          {/* Right: Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Org / Account pill */}
            {userProfile && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-card text-xs font-mono">
                <Building2 className="h-3.5 w-3.5 text-sky-500 flex-shrink-0" />
                <div className="text-left leading-tight">
                  <div className="font-bold text-foreground truncate max-w-[140px]">
                    {userProfile.business_name || userProfile.full_name}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {userProfile.city ? `${userProfile.city}, ${userProfile.state || 'IN'}` : 'Verified Shipper'}
                  </div>
                </div>
              </div>
            )}

            {/* Rail Availability */}
            <button
              type="button"
              onClick={() => setIsRailBookingModalOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition duration-200 shadow-sm flex items-center gap-1.5 cursor-pointer"
              title="View Rail Container Availability & Book Slots"
            >
              <Train className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Rail Availability</span>
            </button>

            {/* AI Predictions */}
            <button
              type="button"
              onClick={() => setShowPredictionStudio(!showPredictionStudio)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition duration-200 shadow flex items-center gap-1.5 cursor-pointer ${
                showPredictionStudio
                  ? 'bg-primary border-primary text-primary-foreground font-bold ring-2 ring-primary/30'
                  : 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
              }`}
              title="Toggle AI Prediction Engine Studio"
            >
              <Brain className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">AI Predictions</span>
            </button>

            {/* Preview OS */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('lonics:open-preview'))}
              className="px-3 py-1.5 rounded-lg text-xs font-mono border border-slate-200 dark:border-zinc-800 bg-card text-foreground hover:bg-muted transition duration-200 flex items-center gap-1.5 cursor-pointer"
              title="Lock and view Operational Preview"
            >
              <Activity className="h-3.5 w-3.5 text-sky-500" />
              <span className="hidden sm:inline">Preview OS</span>
            </button>

            {/* Theme toggle */}
            <button
              type="button"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="px-3 py-1.5 rounded-lg text-xs font-mono border border-slate-200 dark:border-zinc-800 bg-card text-foreground hover:bg-muted transition duration-200 flex items-center gap-1.5 cursor-pointer"
            >
              {theme === 'light' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{theme === 'light' ? 'Dark' : 'Light'}</span>
            </button>

            {/* Sign Out */}
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="px-3 py-1.5 rounded-lg text-xs font-mono border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition duration-200 flex items-center gap-1.5 cursor-pointer"
                title="Sign Out of Lonics"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}
          </div>
        </header>

        {/* Global Statistics Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card/45 border border-slate-200 dark:border-zinc-800 backdrop-blur-md p-4 rounded-xl flex items-center gap-4 transition hover:border-primary/40">
            <div className="p-3 bg-sky-100 dark:bg-sky-950/30 rounded-lg border border-sky-200 dark:border-sky-800/30 text-sky-600 dark:text-sky-400">
              <ListTodo className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Active Agents Running</p>
              <h3 className="text-2xl font-bold font-mono mt-0.5">{metricsSummary.activeTasks}</h3>
            </div>
          </div>
          <div className="bg-card/45 border border-slate-200 dark:border-zinc-800 backdrop-blur-md p-4 rounded-xl flex items-center gap-4 transition hover:border-primary/40">
            <div className="p-3 bg-rose-100 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-800/30 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Unresolved Failures</p>
              <h3 className="text-2xl font-bold font-mono mt-0.5 text-rose-600 dark:text-rose-400">{metricsSummary.totalErrors}</h3>
            </div>
          </div>
          <div className="bg-card/45 border border-slate-200 dark:border-zinc-800 backdrop-blur-md p-4 rounded-xl flex items-center gap-4 transition hover:border-primary/40">
            <div className="p-3 bg-cyan-100 dark:bg-orange-950/30 rounded-lg border border-cyan-200 dark:border-orange-800/30 text-cyan-600 dark:text-orange-400">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Average Link Latency</p>
              <h3 className="text-2xl font-bold font-mono mt-0.5">{metricsSummary.averageLatency} ms</h3>
            </div>
          </div>
          <div className="bg-card/45 border border-slate-200 dark:border-zinc-800 backdrop-blur-md p-4 rounded-xl flex items-center gap-4 transition hover:border-primary/40">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800/30 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Operational SLA Status</p>
              <h3 className="text-2xl font-bold font-mono mt-0.5 text-emerald-600 dark:text-emerald-400">{metricsSummary.systemUptime}</h3>
            </div>
          </div>
        </div>

        {/* AI Prediction Studio Section (Rendered when toggled) */}
        {showPredictionStudio && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
          >
            <AIPredictionDashboard onClose={() => setShowPredictionStudio(false)} />
          </motion.div>
        )}

        {/* Desktop View Layout (visible on md and larger viewports) */}
        <div className="hidden md:grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* LEFT: Quoting Console & LCL Consolidation Monitor */}
          <div className="xl:col-span-8 space-y-6">
            <QuotingConsole onBookingCreated={handleBookingCreated} />
            <ConsolidationMonitor />
          </div>

          {/* RIGHT: Live Telemetry Signals & Monthly Freight Billing */}
          <div className="xl:col-span-4 space-y-6">
            <MultiSignalTracker activeBookingId={activeBookingId} />
            <MonthlyBillingPanel activeBookingId={activeBookingId} />
          </div>
        </div>

        {/* Mobile View Layout (visible on viewports below md) */}
        <div className="block md:hidden pb-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              {activeTab === 'Book' && <QuotingConsole onBookingCreated={handleBookingCreated} />}
              {activeTab === 'Track' && (
                <div className="space-y-6">
                  <MultiSignalTracker activeBookingId={activeBookingId} />
                  <MonthlyBillingPanel activeBookingId={activeBookingId} />
                </div>
              )}
              {activeTab === 'Monitor' && <ConsolidationMonitor />}
              {activeTab === 'Predict' && <AIPredictionDashboard />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Agent Matrix Visualizer (Collapsible) */}
        <div className="bg-card/30 border border-slate-200 dark:border-zinc-800 backdrop-blur-md rounded-2xl p-5 shadow-lg">
          <button
            type="button"
            className="w-full flex justify-between items-center text-left cursor-pointer focus:outline-none"
            onClick={() => setIsDiagnosticsExpanded(!isDiagnosticsExpanded)}
          >
            <div>
              <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                <Network className="h-4 w-4 text-primary" /> Multi-Agent Telemetry Grid (11 Active Nodes)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time operational cross-layer inter-agent communication and system metrics
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800">
              <span>{isDiagnosticsExpanded ? 'Collapse Matrix' : 'Expand Matrix'}</span>
              {isDiagnosticsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </button>

          <AnimatePresence>
            {isDiagnosticsExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="pt-6 grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                  {/* Visual Node-to-Node Transmission Grid — spans full 8 cols */}
                  <div className="xl:col-span-8 space-y-5">
                    <div className="bg-card/45 border border-slate-200 dark:border-zinc-800 backdrop-blur-md rounded-xl p-5 shadow-2xl">
                      <div className="border-b border-slate-200 dark:border-zinc-800 pb-3 mb-4 flex flex-wrap justify-between items-center gap-3">
                        <div>
                          <h3 className="font-bold text-sm text-foreground">Operational Node Matrix</h3>
                          <p className="text-xs text-muted-foreground">11×11 cross-layer inter-agent telemetry</p>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] font-mono">
                          <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500"></span> Connected</div>
                          <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary animate-pulse"></span> Active Flow</div>
                          <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500"></span> Signal Interruption</div>
                        </div>
                      </div>

                      {/* Column Headers row */}
                      <div className="overflow-x-auto sm:overflow-x-visible">
                        <div className="min-w-[480px]">
                          <div className="grid gap-1.5 mb-2 text-[10px] font-mono text-muted-foreground font-bold"
                               style={{ gridTemplateColumns: '140px repeat(11, 1fr)' }}>
                            <div className="text-left pl-1 uppercase tracking-wider text-[9px]">LAYER</div>
                            {AGENT_LIST.map((a) => (
                              <div key={a.id} className="text-center truncate uppercase text-[9px]" title={a.name}>
                                {a.name.slice(0, 3)}
                              </div>
                            ))}
                          </div>

                          {/* 11 Matrix Rows */}
                          <div className="space-y-1.5">
                            {AGENT_LIST.map((src) => (
                              <div key={src.id} className="grid gap-1.5 items-center"
                                   style={{ gridTemplateColumns: '140px repeat(11, 1fr)' }}>
                                {/* Row label */}
                                <div className="text-[11px] font-mono font-medium truncate text-muted-foreground pl-1 text-left" title={src.name}>
                                  {src.name}
                                </div>
                                {/* 11 square telemetry cells */}
                                {AGENT_LIST.map((tgt) => {
                                  const link = links[src.id]?.[tgt.id];
                                  return (
                                    <div
                                      key={tgt.id}
                                      className={`relative group w-full aspect-square rounded-md border flex items-center justify-center cursor-pointer transition duration-150 ${
                                        link?.status === 'inactive'
                                          ? 'bg-muted/15 border-border/30 hover:bg-muted/40 hover:border-border/70'
                                          : 'bg-muted/50 border-border/70 hover:border-primary/60'
                                      }`}
                                    >
                                      {link && (
                                        <span
                                          className={`h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full transition-all duration-300 ${getLinkStatusColor(
                                            link.status
                                          )} ${link.status === 'transmitting' ? 'animate-pulse scale-110' : ''}`}
                                        />
                                      )}

                                      {/* Hover Tooltip */}
                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 rounded-lg bg-popover text-popover-foreground border border-border text-[10px] text-left opacity-0 pointer-events-none group-hover:opacity-100 transition duration-200 z-50 shadow-xl">
                                        <p className="font-bold text-foreground">
                                          {src.name} → {tgt.name}
                                        </p>
                                        {link?.status !== 'inactive' ? (
                                          <div className="mt-1 space-y-0.5 text-muted-foreground">
                                            <p>Status: <span className="capitalize text-foreground font-semibold">{link?.status}</span></p>
                                            <p>Bandwidth: <span className="text-foreground">{link?.bandwidthKbps} Kbps</span></p>
                                            <p>Errors: <span className="text-foreground">{(link?.errorRate ?? 0 * 100).toFixed(1)}%</span></p>
                                            <p>Transmitted: <span className="text-foreground">{link?.messagesTransmitted}</span></p>
                                          </div>
                                        ) : (
                                          <p className="text-muted-foreground mt-0.5">Channel Offline</p>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* List of 11 Operational Layer Status Nodes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {AGENT_LIST.map((agentInfo) => {
                        const agentState = agents[agentInfo.id];
                        const isSelected = selectedAgentId === agentInfo.id;
                        return (
                          <div
                            key={agentInfo.id}
                            className={`p-3 rounded-xl border backdrop-blur-md cursor-pointer transition-all duration-200 ${isSelected
                                ? 'bg-primary/15 border-primary shadow-md shadow-primary/5'
                                : 'bg-card/45 border-slate-200 dark:border-zinc-800 hover:border-primary/45 hover:bg-muted/10'
                              }`}
                            onClick={() => setSelectedAgentId(agentInfo.id)}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="truncate">
                                <h3 className={`font-bold text-xs truncate transition duration-150 ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                                  {agentInfo.name}
                                </h3>
                                <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{agentInfo.desc}</p>
                              </div>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono border uppercase ${getStatusColor(agentState.status)}`}>
                                {agentState.status}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Diagnostics Detail Card */}
                  <div className="xl:col-span-4 bg-card/45 border border-slate-200 dark:border-zinc-800 backdrop-blur-md rounded-xl p-5 shadow-2xl space-y-4 animate-fade-in">
                    <div className="border-b border-slate-200 dark:border-zinc-800 pb-3 flex justify-between items-center">
                      <div>
                        <h2 className="font-bold text-sm text-foreground">Orchestration Diagnostics</h2>
                        <p className="text-xs text-primary font-mono uppercase tracking-wider">{activeAgent.name}</p>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                        <Clock className="h-3 w-3" /> V{activeAgent.metadata.version}
                      </div>
                    </div>

                    {/* Status Override */}
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide mb-1.5">Manual State Override</p>
                      <div className="grid grid-cols-3 gap-1">
                        {(['working', 'idle', 'waiting', 'success', 'failed', 'paused'] as const).map((st) => (
                          <button
                            key={st}
                            type="button"
                            className={`px-2 py-1 rounded text-[9px] font-mono border capitalize transition duration-150 cursor-pointer ${activeAgent.status === st
                                ? getStatusColor(st) + ' border font-bold ring-1 ring-primary/20'
                                : 'bg-background/40 border-slate-200 dark:border-zinc-800 hover:bg-muted hover:text-foreground text-muted-foreground'
                              }`}
                            onClick={() => handleStatusChange(selectedAgentId, st)}
                          >
                            {st}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="space-y-2">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wide">Performance Metrics</p>
                      <div className="bg-background/80 rounded-lg border border-slate-200 dark:border-zinc-800 p-2.5 grid grid-cols-2 gap-3 text-[10px] font-mono">
                        <div className="space-y-0.5">
                          <div className="flex justify-between text-muted-foreground">
                            <span>CPU LOAD</span>
                            <span className="text-foreground font-bold">{activeAgent.metrics.cpuUsagePercent}%</span>
                          </div>
                          <div className="h-0.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${activeAgent.metrics.cpuUsagePercent}%` }}></div>
                          </div>
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex justify-between text-muted-foreground">
                            <span>MEMORY</span>
                            <span className="text-foreground font-bold">{activeAgent.metrics.memoryUsageMb}M</span>
                          </div>
                          <div className="h-0.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-sky-500" style={{ width: `${Math.min(100, (activeAgent.metrics.memoryUsageMb / 512) * 100)}%` }}></div>
                          </div>
                        </div>
                        <div className="border-t border-slate-200 dark:border-zinc-800 pt-2 col-span-2 grid grid-cols-2 gap-1 text-[9px] text-muted-foreground">
                          <div>MSGS: <span className="text-foreground">{activeAgent.metrics.messagesProcessed}</span></div>
                          <div className="text-right">LATENCY: <span className="text-foreground">{activeAgent.metrics.averageLatencyMs}ms</span></div>
                          <div>ACCURACY: <span className="text-emerald-500">{(activeAgent.metrics.successRate * 100).toFixed(1)}%</span></div>
                          <div className="text-right">UPTIME: <span className="text-foreground">{Math.round(activeAgent.metrics.uptimeSeconds / 3600)}h</span></div>
                        </div>
                      </div>
                    </div>

                    {/* AI Prediction Studio Quick Launch Button */}
                    {selectedAgentId === 'TRAJECTORY_PREDICTOR' && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowPredictionStudio(true);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="w-full py-2 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-700 text-white font-mono font-bold text-xs rounded-lg transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Brain className="w-4 h-4" />
                        Launch AI Prediction Studio
                      </button>
                    )}

                    {/* Error stack */}
                    {activeAgent.errors.length > 0 && (
                      <div className="space-y-1 bg-destructive/10 border border-destructive/40 p-2.5 rounded-lg text-[10px]">
                        <div className="flex items-center gap-1 text-destructive font-semibold mb-1">
                          <ShieldAlert className="h-3.5 w-3.5" /> Telemetry Failure Log
                        </div>
                        {activeAgent.errors.map((err) => (
                          <div key={err.id} className="space-y-0.5">
                            <p className="font-mono text-destructive font-bold text-[9px]">{err.code}</p>
                            <p className="text-foreground leading-normal">{err.message}</p>
                            <p className="text-[8px] text-muted-foreground font-mono">{new Date(err.timestamp).toLocaleTimeString()}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sticky Mobile Bottom Navigation Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 border-t border-slate-200 dark:border-zinc-800 backdrop-blur-md py-3 px-4 flex justify-around items-center md:hidden shadow-[0_-8px_30px_rgba(0,0,0,0.3)]">
          {(['Book', 'Track', 'Monitor', 'Predict'] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`relative flex flex-col items-center gap-1 py-1 px-3 text-[10px] font-mono tracking-wider uppercase transition duration-200 cursor-pointer ${isActive ? 'text-primary font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="activeTabIndicator"
                    className="absolute inset-0 bg-primary/10 rounded-lg -z-10"
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                  />
                )}
                {tab === 'Book' && <Calculator className="h-4 w-4" />}
                {tab === 'Track' && <Compass className="h-4 w-4" />}
                {tab === 'Monitor' && <Layers className="h-4 w-4" />}
                {tab === 'Predict' && <Brain className="h-4 w-4" />}
                <span>{tab}</span>
              </button>
            );
          })}
        </div>

        {/* Rail Container Availability & Reservation Modal */}
        <RailContainerBookingModal
          isOpen={isRailBookingModalOpen}
          onClose={() => setIsRailBookingModalOpen(false)}
          currentTheme={theme}
          onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        />

      </div>
    </div>
  );
}
