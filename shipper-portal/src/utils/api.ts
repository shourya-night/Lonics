export interface CargoItem {
  package_type: string;
  cargo_class?: string;
  length: number;
  width: number;
  height: number;
  quantity: number;
  weight_kg: number;
}

export interface BookingRequest {
  shipper_id: string;
  origin: string;
  destination: string;
  cargo_items: CargoItem[];
  commodity?: string;
  rail_lock_upgrade: boolean;
}

export interface PredictionInsights {
  origin: string;
  destination: string;
  commodity: string;
  weight_tonnes: number;
  month: number;
  rail_suitability: number;
  consolidation_potential: number;
  network_pressure: number;
  demand_outlook: string;
  recommendation: string;
  reasons: string[];
  data_limitations: string[];
}

export interface BookingResponse {
  booking_id: string;
  chargeable_weight: number;
  total_cbm: number;
  base_price: number;
  contingency_buffer: number;
  final_quote: number;
  status: string;
  assigned_window_id: string | null;
  prediction_insights?: PredictionInsights | null;
}

export interface ContainerStatusResponse {
  window_id: string;
  current_cbm: number;
  current_kg: number;
  max_cbm_threshold: number;
  max_kg_threshold: number;
}

export interface CancellationResponse {
  status: string;
  booking_id: string;
  detail: string;
}

export interface ForecastPointItem {
  forecast_period: string;
  predicted_freight_mt: number;
  growth_percent: number;
  prediction_interval: {
    lower: number;
    upper: number;
  };
}

export interface MonthlyForecastItem {
  month: string;
  month_number: number;
  predicted_freight_mt: number;
  seasonal_index: number;
  prediction_interval: {
    lower: number;
    upper: number;
  };
}

export interface FreightForecastResponse {
  historical: Array<{ fiscal_year: string; freight_mt: number }>;
  forecasts: ForecastPointItem[];
  latest_actual: { fiscal_year: string; freight_mt: number };
  model: string;
  model_metrics: {
    model: string;
    mae: number;
    rmse: number;
    mape: number;
    n_backtests: number;
  };
  all_model_metrics: Record<string, any>;
}

export interface MonthlyForecastResponse {
  historical_monthly: Array<{ month: string; freight_mt: number }>;
  forecasts: MonthlyForecastItem[];
  seasonal_patterns: Record<string, number>;
  latest_month: { month: string; freight_mt: number };
}

export interface NetworkPressureResponse {
  available: boolean;
  score: number;
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  drivers: string[];
  components: {
    capacity_utilization: { score: number; weight: number };
    freight_growth: { score: number; weight: number };
    train_density: { score: number; weight: number };
    dfc_load: { score: number; weight: number };
  };
  note: string;
}

export interface ShipmentPredictionRequest {
  origin: string;
  destination: string;
  commodity?: string;
  weight_tonnes: number;
  month?: number;
}

const SERVER_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const BASE_URL = `${SERVER_URL}/api/v1/freight`;

export async function bookFreight(payload: BookingRequest): Promise<BookingResponse> {
  const res = await fetch(`${BASE_URL}/book`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Failed to book freight: ${res.statusText}`);
  }

  return res.json();
}

export async function cancelFreight(bookingId: string): Promise<CancellationResponse> {
  const res = await fetch(`${BASE_URL}/cancel/${bookingId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to cancel freight: ${res.statusText}`);
  }

  return res.json();
}

export async function getContainerStatus(): Promise<ContainerStatusResponse> {
  const res = await fetch(`${BASE_URL}/container-status`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch container status: ${res.statusText}`);
  }

  return res.json();
}

export async function getTrackingStatus(bookingId: string): Promise<any> {
  const res = await fetch(`${SERVER_URL}/api/tracking/${bookingId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch tracking status: ${res.statusText}`);
  }

  return res.json();
}

export async function scanTrackingCode(code: string): Promise<any> {
  const res = await fetch(`${SERVER_URL}/api/tracking/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  });

  if (!res.ok) {
    throw new Error(`Failed to scan tracking code: ${res.statusText}`);
  }

  return res.json();
}

// ══════════════════════════════════════════════════════════════════════════════
// AI PREDICTION ENGINE API METHODS
// ══════════════════════════════════════════════════════════════════════════════

export async function getFreightForecast(periods: number = 5): Promise<FreightForecastResponse> {
  const res = await fetch(`${SERVER_URL}/api/predictions/freight?periods=${periods}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Freight forecast error: ${res.statusText}`);
  return res.json();
}

export async function getMonthlyForecast(periods: number = 12): Promise<MonthlyForecastResponse> {
  const res = await fetch(`${SERVER_URL}/api/predictions/monthly?periods=${periods}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Monthly forecast error: ${res.statusText}`);
  return res.json();
}

export async function getCommodityForecast(periods: number = 3): Promise<any> {
  const res = await fetch(`${SERVER_URL}/api/predictions/commodities?periods=${periods}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Commodities forecast error: ${res.statusText}`);
  return res.json();
}

export async function getNetworkPressure(): Promise<NetworkPressureResponse> {
  const res = await fetch(`${SERVER_URL}/api/predictions/network`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Network pressure error: ${res.statusText}`);
  return res.json();
}

export async function predictShipment(payload: ShipmentPredictionRequest): Promise<PredictionInsights> {
  const res = await fetch(`${SERVER_URL}/api/predictions/shipment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Shipment prediction error: ${res.statusText}`);
  return res.json();
}

export async function getModelPerformance(): Promise<any> {
  const res = await fetch(`${SERVER_URL}/api/predictions/model-performance`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Model performance error: ${res.statusText}`);
  return res.json();
}
