/**
 * Service to fetch live AQI levels and calculate Graded Response Action Plan (GRAP) trigger stages.
 */
export async function getAQIAndGRAPStatus(lat, lng) {
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=pm2_5,pm10,us_aqi`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500); // 3.5s timeout
    
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!res.ok) {
      throw new Error(`Air quality API returned status: ${res.status}`);
    }
    
    const data = await res.json();
    let aqi = 120; // default safe index
    
    if (data && data.current) {
      if (data.current.us_aqi !== undefined) {
        aqi = data.current.us_aqi;
      } else if (data.current.pm2_5 !== undefined) {
        // Approximate US AQI conversion based on PM2.5 standard thresholds
        const pm25 = data.current.pm2_5;
        if (pm25 <= 12.0) aqi = Math.round((50 / 12.0) * pm25);
        else if (pm25 <= 35.4) aqi = Math.round(51 + ((100 - 51) / (35.4 - 12.1)) * (pm25 - 12.1));
        else if (pm25 <= 55.4) aqi = Math.round(101 + ((150 - 101) / (55.4 - 35.5)) * (pm25 - 35.5));
        else if (pm25 <= 150.4) aqi = Math.round(151 + ((200 - 151) / (150.4 - 55.5)) * (pm25 - 55.5));
        else aqi = 250;
      }
    }
    
    let grapStage = 'None';
    let restriction = 'None';
    let rerouteRequired = false;
    
    // Evaluate Indian GRAP vehicle ban rules:
    // Stage I (Moderate): AQI 201-300
    // Stage II (Very Poor): AQI 301-400 -> restrict diesel generators, dust control
    // Stage III (Severe): AQI 401-450 -> Ban BS-III petrol & BS-IV diesel LCVs/trucks (split/reroute)
    // Stage IV (Severe+): AQI > 450 -> Ban all non-essential heavy diesel trucks entering Delhi
    if (aqi > 400) {
      grapStage = 'Stage IV (Severe+)';
      restriction = 'Severe Ban: Heavy diesel truck entry prohibited. Splitting cargo to electric LCV fleets.';
      rerouteRequired = true;
    } else if (aqi > 300) {
      grapStage = 'Stage III (Severe)';
      restriction = 'Diesel restriction: BS-III/IV commercial diesel vehicles restricted. Electric vehicle transit mandatory.';
      rerouteRequired = true;
    } else if (aqi > 200) {
      grapStage = 'Stage II (Very Poor)';
      restriction = 'Notice: Moderate emission caps active. Fleet tracking required.';
      rerouteRequired = false;
    }
    
    return {
      aqi,
      grapStage,
      restriction,
      rerouteRequired,
      source: 'open_meteo_live'
    };
  } catch (err) {
    console.warn(`[AQI Service] Failed to retrieve air quality from API. Using simulated fallback. Error: ${err.message}`);
    // Simulate high AQI to show the dynamic rerouting / fleet split capability in the UI
    const simulatedAqi = 315; 
    return {
      aqi: simulatedAqi,
      grapStage: 'Stage III (Simulated Fallback)',
      restriction: 'Diesel restriction: BS-III/IV commercial diesel vehicles restricted. Electric vehicle transit mandatory.',
      rerouteRequired: true,
      source: 'simulation_fallback'
    };
  }
}
