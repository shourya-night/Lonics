export interface IndianLocation {
  city: string;
  state: string;
  corridor?: string;
  isMajorHub?: boolean;
}

export const INDIAN_LOCATIONS: IndianLocation[] = [
  { city: 'Surat', state: 'Gujarat', corridor: 'Western DFC / Textile & Diamond Hub', isMajorHub: true },
  { city: 'Ahmedabad', state: 'Gujarat', corridor: 'Western DFC / Sanand Auto Cluster', isMajorHub: true },
  { city: 'Morbi', state: 'Gujarat', corridor: 'Ceramics & Tiles Export Cluster', isMajorHub: true },
  { city: 'Vadodara', state: 'Gujarat', corridor: 'Engineering & Chemical Hub', isMajorHub: true },
  { city: 'Rajkot', state: 'Gujarat', corridor: 'Casting & Machine Tools Hub', isMajorHub: true },
  { city: 'Delhi-NCR', state: 'Delhi', corridor: 'Tughlakabad ICD / Northern DFC Gateway', isMajorHub: true },
  { city: 'Ludhiana', state: 'Punjab', corridor: 'Hosiery, Fasteners & Cycle Hub', isMajorHub: true },
  { city: 'Mumbai', state: 'Maharashtra', corridor: 'JNPT Port / Western Logistics Gateway', isMajorHub: true },
  { city: 'Pune', state: 'Maharashtra', corridor: 'Automotive & Heavy Engineering Cluster', isMajorHub: true },
  { city: 'Nagpur', state: 'Maharashtra', corridor: 'MIHAN / Multi-Modal Inland Hub', isMajorHub: true },
  { city: 'Bengaluru', state: 'Karnataka', corridor: 'Electronics & Aerospace Corridor', isMajorHub: true },
  { city: 'Chennai', state: 'Tamil Nadu', corridor: 'Ennore / Chennai Port Auto Cluster', isMajorHub: true },
  { city: 'Tiruppur', state: 'Tamil Nadu', corridor: 'Knitwear & Export Garments Hub', isMajorHub: true },
  { city: 'Coimbatore', state: 'Tamil Nadu', corridor: 'Pumps, Motors & Foundry Cluster', isMajorHub: true },
  { city: 'Hyderabad', state: 'Telangana', corridor: 'Pharma & Precision Engineering Hub', isMajorHub: true },
  { city: 'Indore', state: 'Madhya Pradesh', corridor: 'Pithampur Industrial Corridor', isMajorHub: true },
  { city: 'Jaipur', state: 'Rajasthan', corridor: 'Handicrafts, Gems & Minerals Hub', isMajorHub: true },
  { city: 'Kanpur', state: 'Uttar Pradesh', corridor: 'Leather, Footwear & Heavy Defense Hub', isMajorHub: true },
  { city: 'Kolkata', state: 'West Bengal', corridor: 'Eastern Port & Heavy Metallurgy Gateway', isMajorHub: true },
  { city: 'Jalandhar', state: 'Punjab', corridor: 'Sports Goods & Hand Tools Cluster' },
  { city: 'Panipat', state: 'Haryana', corridor: 'Textile Recycling & Shoddy Yarn Hub' },
  { city: 'Faridabad', state: 'Haryana', corridor: 'Sheet Metal & Automotive Hub' },
  { city: 'Noida / Greater Noida', state: 'Uttar Pradesh', corridor: 'Electronics & Mobile Assembly Hub' },
  { city: 'Agra', state: 'Uttar Pradesh', corridor: 'Footwear & Casting Cluster' },
  { city: 'Bhiwandi', state: 'Maharashtra', corridor: 'Warehousing & Logistics Cluster' },
  { city: 'Aurangabad', state: 'Maharashtra', corridor: 'Auto & Engineering Corridor' },
  { city: 'Vapi', state: 'Gujarat', corridor: 'Paper & Chemical Industrial Belt' },
  { city: 'Ankleshwar', state: 'Gujarat', corridor: 'Pharmaceutical & Dyes Hub' },
  { city: 'Kochi', state: 'Kerala', corridor: 'Cochin Port / Spices & Marine Export' },
  { city: 'Visakhapatnam', state: 'Andhra Pradesh', corridor: 'Vizag Port & Steel Corridor' },
  { city: 'Bhubaneswar', state: 'Odisha', corridor: 'Minerals & Metal Processing Cluster' },
  { city: 'Raipur', state: 'Chhattisgarh', corridor: 'Sponge Iron & Steel Hub' },
  { city: 'Guwahati', state: 'Assam', corridor: 'Northeast Logistics Gateway' },
];

export const INDIAN_STATES: string[] = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan',
  'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal'
];

export function filterLocations(query: string): IndianLocation[] {
  const clean = query.trim().toLowerCase();
  if (!clean) return INDIAN_LOCATIONS.filter(l => l.isMajorHub);
  return INDIAN_LOCATIONS.filter(l =>
    l.city.toLowerCase().includes(clean) ||
    l.state.toLowerCase().includes(clean) ||
    (l.corridor && l.corridor.toLowerCase().includes(clean))
  );
}
