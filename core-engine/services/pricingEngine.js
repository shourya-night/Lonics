const CITY_COORDINATES = {
  'mumbai': { lat: 19.0760, lng: 72.8777 },
  'delhi': { lat: 28.6139, lng: 77.2090 },
  'dadri': { lat: 28.5300, lng: 77.5532 },
  'mumbai port dfc gate-1': { lat: 19.0760, lng: 72.8777 },
  'delhi icd terminal-3': { lat: 28.6139, lng: 77.2090 }
};

const DEFAULT_ORIGIN = CITY_COORDINATES['mumbai'];
const DEFAULT_DEST = CITY_COORDINATES['delhi'];

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
  
  // Generic pattern checks
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
  
  // Curvature/winding factor: road routes are roughly 20-30% longer than straight lines
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
    const timeout = setTimeout(() => controller.abort(), 3500); // 3.5s timeout for OSRM API
    
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
 * Calculates dual brain pricing comparison.
 * Mimics Indian Railways freight rates vs road freight rates based on OSRM distance.
 */
export async function calculateHybridRates(originName, destName, chargeableWeightKg) {
  const origin = resolveCoordinates(originName, true);
  const dest = resolveCoordinates(destName, false);
  
  // Query OSRM routing distance
  const route = await getOSRMDistance(origin, dest);
  const distanceKm = route.distanceKm;

  // 1. Static Tariff mimic of Indian Railways (Class 150)
  // Scaled equation to align with the frontend's expected ₹9.0 per kg for ~1300km Mumbai-Delhi
  const railRateFactor = distanceKm * 0.005 + 2.5; 
  const railBasePrice = chargeableWeightKg * railRateFactor;
  
  // 2. Road Shadow pricing (Spot)
  // Scaled equation to align with the frontend's expected ₹14.5 per kg for ~1300km Mumbai-Delhi
  const roadRateFactor = distanceKm * 0.009 + 3.5;
  const roadShadowPrice = chargeableWeightKg * roadRateFactor;

  return {
    originCoords: origin,
    destCoords: dest,
    distanceKm: parseFloat(distanceKm.toFixed(2)),
    routeSource: route.source,
    railBasePrice: parseFloat(railBasePrice.toFixed(2)),
    roadShadowPrice: parseFloat(roadShadowPrice.toFixed(2))
  };
}
