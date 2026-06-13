export interface CargoItem {
  package_type: string;
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
  rail_lock_upgrade: boolean;
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

const BASE_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/v1/freight`;

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
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/tracking/${bookingId}`, {
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
  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/tracking/scan`, {
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

