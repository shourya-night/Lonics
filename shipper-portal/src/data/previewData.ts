/**
 * Lonics Operational Preview Data Layer
 * 
 * This module isolates all mock operational data and simulated telemetry
 * for the preview lock-screen experience. The UI components consume this
 * data via `getOperationalPreviewData()` or direct typed imports.
 * 
 * In the future, `getOperationalPreviewData()` can be converted to an async
 * fetch calling the Lonics core-engine / telemetry API without requiring
 * any UI component redesigns.
 */

export interface PreviewTelemetry {
  systemStatus: 'ONLINE' | 'DEGRADED' | 'MAINTENANCE';
  activeAgentsCount: string;
  simulatedLatencyMs: number;
  activeCorridorsCount: number;
  nodeCluster: string;
}

export interface ShipmentHistoryItem {
  id: string;
  origin: string;
  destination: string;
  completionDate: string;
  tonnage: number;
  chargeRupees: number;
  status: 'Completed' | 'Delivered';
  mode: string;
}

export interface CurrentShipmentItem {
  id: string;
  loadCode: string;
  origin: string;
  destination: string;
  progressPercent: number;
  statusText: 'IN TRANSIT' | 'AT TERMINAL' | 'DISPATCH' | 'OUT FOR DELIVERY';
  eta: string;
  currentWaypoint: string;
  statusType: 'transit' | 'terminal' | 'dispatch';
}

export interface ForecastPoint {
  month: string;
  tonnage: number;
  isForecast: boolean;
  lowerBound?: number;
  upperBound?: number;
}

export interface RoutePredictionData {
  corridor: string;
  corridorTag: string;
  demandDeltaPercent: number;
  forecastTonnage: number;
  confidencePercent: number;
  recommendedWindow: string;
  modelIdentifier: string;
  series: ForecastPoint[];
}

export interface BillingBreakdown {
  railPercent: number;
  lastMilePercent: number;
  terminalPercent: number;
}

export interface BillingData {
  currentMonthSpendRupees: number;
  previousMonthDeltaPercent: number;
  savingsRealizedRupees: number;
  breakdown: BillingBreakdown;
  activeInvoicesCount: number;
  billingPeriod: string;
}

export interface OperationalPreviewData {
  telemetry: PreviewTelemetry;
  shipmentHistory: ShipmentHistoryItem[];
  currentShipments: CurrentShipmentItem[];
  routePrediction: RoutePredictionData;
  billing: BillingData;
}

export const mockOperationalPreviewData: OperationalPreviewData = {
  telemetry: {
    systemStatus: 'ONLINE',
    activeAgentsCount: '11/11',
    simulatedLatencyMs: 42,
    activeCorridorsCount: 4,
    nodeCluster: 'IND-NORTH-WEST-01',
  },
  shipmentHistory: [
    {
      id: 'hist-01',
      origin: 'Delhi',
      destination: 'Mumbai',
      completionDate: '18 Aug',
      tonnage: 24.5,
      chargeRupees: 48200,
      status: 'Delivered',
      mode: 'Rail CTO',
    },
    {
      id: 'hist-02',
      origin: 'Delhi',
      destination: 'Pune',
      completionDate: '15 Aug',
      tonnage: 18.2,
      chargeRupees: 36400,
      status: 'Delivered',
      mode: 'Multimodal',
    },
    {
      id: 'hist-03',
      origin: 'Jaipur',
      destination: 'Delhi',
      completionDate: '12 Aug',
      tonnage: 32.0,
      chargeRupees: 58900,
      status: 'Delivered',
      mode: 'Rail CTO',
    },
    {
      id: 'hist-04',
      origin: 'Ahmedabad',
      destination: 'Delhi',
      completionDate: '09 Aug',
      tonnage: 14.8,
      chargeRupees: 29800,
      status: 'Delivered',
      mode: 'Multimodal',
    },
  ],
  currentShipments: [
    {
      id: 'curr-01',
      loadCode: 'LON-8842',
      origin: 'Mumbai',
      destination: 'Delhi',
      progressPercent: 78,
      statusText: 'IN TRANSIT',
      eta: '14:40',
      currentWaypoint: 'Vadodara Jn',
      statusType: 'transit',
    },
    {
      id: 'curr-02',
      loadCode: 'LON-8910',
      origin: 'Kolkata',
      destination: 'Delhi',
      progressPercent: 46,
      statusText: 'AT TERMINAL',
      eta: 'Tomorrow',
      currentWaypoint: 'Tughlakabad ICD',
      statusType: 'terminal',
    },
    {
      id: 'curr-03',
      loadCode: 'LON-8755',
      origin: 'Bengaluru',
      destination: 'Delhi',
      progressPercent: 15,
      statusText: 'DISPATCH',
      eta: '24 Aug',
      currentWaypoint: 'Whitefield Hub',
      statusType: 'dispatch',
    },
  ],
  routePrediction: {
    corridor: 'Delhi → Mumbai',
    corridorTag: 'PRIMARY CORRIDOR',
    demandDeltaPercent: 18,
    forecastTonnage: 1240,
    confidencePercent: 87,
    recommendedWindow: 'Next 7–10 days',
    modelIdentifier: 'LONICS-PREDICT-V2.4',
    series: [
      { month: 'Jan', tonnage: 820, isForecast: false },
      { month: 'Feb', tonnage: 910, isForecast: false },
      { month: 'Mar', tonnage: 870, isForecast: false },
      { month: 'Apr', tonnage: 1020, isForecast: false },
      { month: 'May', tonnage: 1080, isForecast: false },
      { month: 'Jun', tonnage: 1150, isForecast: false },
      { month: 'Jul', tonnage: 1190, isForecast: true, lowerBound: 1120, upperBound: 1260 },
      { month: 'Aug', tonnage: 1240, isForecast: true, lowerBound: 1160, upperBound: 1320 },
      { month: 'Sep', tonnage: 1310, isForecast: true, lowerBound: 1220, upperBound: 1400 },
      { month: 'Oct', tonnage: 1360, isForecast: true, lowerBound: 1260, upperBound: 1460 },
    ],
  },
  billing: {
    currentMonthSpendRupees: 284620,
    previousMonthDeltaPercent: -8.4,
    savingsRealizedRupees: 74500,
    breakdown: {
      railPercent: 64,
      lastMilePercent: 24,
      terminalPercent: 12,
    },
    activeInvoicesCount: 4,
    billingPeriod: 'CURRENT MONTH',
  },
};

/**
 * Accessor function for preview data.
 * Ready for future async API integration.
 */
export function getOperationalPreviewData(): OperationalPreviewData {
  return mockOperationalPreviewData;
}
