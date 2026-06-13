/**
 * Strict TypeScript types for the 11-Agent State Matrix.
 * Coordinates state, communication, and synchronization across the multi-agent system.
 */

export type AgentId =
  | 'CONSOLIDATION_AGENT'
  | 'COMPATIBILITY_GUARD'
  | 'DIM_WEIGHT_PRICING'
  | 'DUAL_BRAIN_PRICING'
  | 'RISK_GATE_AGENT'
  | 'MULTIMODAL_CONDUCTOR'
  | 'HYBRID_TRACKING_API'
  | 'TRAJECTORY_PREDICTOR'
  | 'URBAN_ROUTING_AGENT'
  | 'COMPLIANCE_NODE'
  | 'RETURN_EXCHANGE_NODE';

export type AgentStatus =
  | 'idle'
  | 'working'
  | 'waiting'
  | 'success'
  | 'failed'
  | 'paused';

export interface AgentMetrics {
  cpuUsagePercent: number;
  memoryUsageMb: number;
  messagesProcessed: number;
  averageLatencyMs: number;
  uptimeSeconds: number;
  successRate: number; // 0 to 1
}

export interface AgentError {
  id: string;
  code: string;
  message: string;
  timestamp: string;
  fatal: boolean;
}

export interface AgentTask {
  id: string;
  description: string;
  startedAt: string;
  progressPercent: number;
  targetEntityId?: string; // e.g. shipmentId, invoiceId, claimId
}

export interface AgentMetadata {
  description: string;
  version: string;
  capabilities: string[];
}

export interface AgentState {
  id: AgentId;
  name: string;
  status: AgentStatus;
  lastActive: string;
  metadata: AgentMetadata;
  metrics: AgentMetrics;
  currentTask?: AgentTask;
  errors: AgentError[];
}

/**
 * Link state representing communication channels between agents.
 */
export type LinkStatus = 'inactive' | 'connected' | 'transmitting' | 'blocked' | 'error';

export interface AgentLink {
  source: AgentId;
  target: AgentId;
  status: LinkStatus;
  bandwidthKbps: number;
  errorRate: number; // 0 to 1
  messagesTransmitted: number;
  lastTransmissionTime?: string;
}

/**
 * The 11-Agent State Matrix represents the state of the system,
 * combining the status of each agent and their communications link matrix.
 */
export interface AgentStateMatrix {
  timestamp: string;
  agents: Record<AgentId, AgentState>;
  /**
   * 11x11 link matrix mapping source -> target connection states.
   */
  links: Record<AgentId, Record<AgentId, AgentLink>>;
  systemLoadPercent: number;
  totalActiveTasks: number;
}

/**
 * Event log system for agent telemetry.
 */
export interface AgentEvent {
  id: string;
  agentId: AgentId;
  timestamp: string;
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  details?: Record<string, any>;
}

/**
 * Real-time inter-agent messages.
 */
export interface AgentMessage {
  id: string;
  from: AgentId;
  to: AgentId;
  payload: {
    action: string;
    data: Record<string, any>;
  };
  timestamp: string;
  encrypted: boolean;
}
