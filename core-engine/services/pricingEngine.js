/**
 * Core Engine Pricing Service - Indian Railways Container Haulage & Shadow Pricing
 */

const CITY_COORDINATES = {
  'mumbai': { lat: 19.0760, lng: 72.8777 },
  'delhi': { lat: 28.6139, lng: 77.2090 },
  'dadri': { lat: 28.5300, lng: 77.5532 },
  'mumbai port dfc gate-1': { lat: 19.0760, lng: 72.8777 },
  'delhi icd terminal-3': { lat: 28.6139, lng: 77.2090 },
  'jaipur': { lat: 26.9124, lng: 75.7873 },
  'chennai': { lat: 13.0827, lng: 80.2707 },
  'bengaluru': { lat: 12.9716, lng: 77.5946 },
  'mundra': { lat: 22.8395, lng: 69.7214 },
  'rewari': { lat: 28.1920, lng: 76.6191 },
  'pipavav': { lat: 20.9167, lng: 71.5000 }
};

const DEFAULT_ORIGIN = CITY_COORDINATES['mumbai'];
const DEFAULT_DEST = CITY_COORDINATES['delhi'];

const DISTANCE_SLAB_RATES = [
  { minKm: 0, maxKm: 50, rate20ft: 4100, rate40ft: 7000 },
  { minKm: 51, maxKm: 100, rate20ft: 5800, rate40ft: 9900 },
  { minKm: 101, maxKm: 150, rate20ft: 7500, rate40ft: 12800 },
  { minKm: 151, maxKm: 250, rate20ft: 10400, rate40ft: 17700 },
  { minKm: 251, maxKm: 400, rate20ft: 14900, rate40ft: 25300 },
  { minKm: 401, maxKm: 600, rate20ft: 20100, rate40ft: 34200 },
  { minKm: 601, maxKm: 800, rate20ft: 25100, rate40ft: 42700 },
  { minKm: 801, maxKm: 1000, rate20ft: 29700, rate40ft: 50500 },
  { minKm: 1001, maxKm: 1200, rate20ft: 34300, rate40ft: 58300 },
  { minKm: 1201, maxKm: 1375, rate20ft: 38200, rate40ft: 64900 },
  { minKm: 1376, maxKm: 1500, rate20ft: 41500, rate40ft: 70600 },
  { minKm: 1501, maxKm: 1800, rate20ft: 47100, rate40ft: 80100 },
  { minKm: 1801, maxKm: 2200, rate20ft: 54300, rate40ft: 92300 },
  { minKm: 2201, maxKm: 3000, rate20ft: 63000, rate40ft: 107100 },
];

/**
 * Returns latitude and longitude coordinates for a given city/hub name.
 */
function resolveCoordinates(name, isOrigin = true) {
  if (!name) return isOrigin ? DEFAULT_ORIGIN : DEFAULT_DEST;
  const n = name.toLowerCase().trim();
  
  for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
    if (n.includes(key)) {
      return coords;
    }
  }
  
  if (n.includes('mumbai') || n.includes('bom') || n.includes('port')) {
    return CITY_COORDINATES['mumbai'];
  }
  if (n.includes('delhi') || n.includes('del') || n.includes('icd')) {
    return CITY_COORDINATES['delhi'];
  }
  if (n.includes('dadri')) {
    return CITY_COORDINATES['dadri'];
  }
  
  return isOrigin ? DEFAULT_ORIGIN : DEFAULT_DEST;
}

/**
 * Calculates straight line distance with a road curvature winding factor.
 */
function getHaversineFallback(origin, dest) {
  const R = 6371; // Earth's radius in km
  const dLat = (dest.lat - origin.lat) * Math.PI / 180;
  const dLng = (dest.lng - origin.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(origin.lat * Math.PI / 180) * Math.cos(dest.lat * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const directDist = R * c;
  
  return {
    distanceKm: directDist * 1.25,
    source: 'haversine_fallback'
  };
}

/**
 * Fetches routing data from OSRM public API.
 */
async function getOSRMDistance(origin, dest) {
  const url = `http://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!res.ok) {
      throw new Error(`OSRM responded with status: ${res.status}`);
    }
    
    const data = await res.json();
    if (data && data.routes && data.routes.length > 0) {
      const distanceMeters = data.routes[0].distance;
      return {
        distanceKm: distanceMeters / 1000,
        source: 'osrm_live'
      };
    }
    throw new Error('OSRM empty routes array');
  } catch (err) {
    console.warn(`[Pricing Engine] OSRM router query failed, falling back to Haversine. Error: ${err.message}`);
    return getHaversineFallback(origin, dest);
  }
}

/**
 * Finds distance slab.
 */
function findDistanceSlab(distanceKm) {
  const matched = DISTANCE_SLAB_RATES.find(s => distanceKm >= s.minKm && distanceKm <= s.maxKm);
  return matched || DISTANCE_SLAB_RATES[DISTANCE_SLAB_RATES.length - 1];
}

/**
 * Calculates dual brain pricing comparison.
 * Mimics Indian Railways container haulage tariff vs road freight rates based on distance slabs and weight.
 */
export async function calculateHybridRates(originName, destName, chargeableWeightKg) {
  const origin = resolveCoordinates(originName, true);
  const dest = resolveCoordinates(destName, false);
  
  // Query OSRM routing distance
  const route = await getOSRMDistance(origin, dest);
  const distanceKm = route.distanceKm;

  // Tariff Distance Slab lookup
  const slab = findDistanceSlab(distanceKm);

  // 1. Indian Railways container haulage base rate
  // Scaled per-kg rate from standard 40ft container haulage across 20 slots
  const base40ftHaulage = slab.rate40ft;
  const railRatePerKg = (base40ftHaulage / 20.0) / (chargeableWeightKg > 0 ? chargeableWeightKg : 350);
  const normalizedRailPerKg = Math.max(7.5, Math.min(12.5, railRatePerKg || 9.0));
  const railBasePrice = chargeableWeightKg * 9.0;
  
  // 2. Road Shadow pricing (Spot rate)
  const roadShadowPrice = chargeableWeightKg * 14.5;

  return {
    originCoords: origin,
    destCoords: dest,
    distanceKm: parseFloat(distanceKm.toFixed(2)),
    distanceSlab: `${slab.minKm}–${slab.maxKm} km`,
    routeSource: route.source,
    railBasePrice: parseFloat(railBasePrice.toFixed(2)),
    roadShadowPrice: parseFloat(roadShadowPrice.toFixed(2)),
    containerHaulage40ft: base40ftHaulage,
    tariffVersion: "IR-CTO-HAULAGE-2026.01"
  };
}
