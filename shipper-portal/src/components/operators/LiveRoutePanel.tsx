import { useState, useEffect, useRef } from 'react';
import { Navigation, Wifi, WifiOff, Gauge, Clock, MapPin } from 'lucide-react';
import { isGPSStale } from '../../utils/operatorLogic';
import { publishGPSUpdate } from '../../services/operationalEvents';
import type { GPSUpdate } from '../../types/operator';

interface LiveRoutePanelProps {
  driverId: string;
  shipmentId: string;
  origin: string;
  destination: string;
  /** ETA string e.g. '08:40' */
  eta: string;
}

// Route progress is estimated from GPS or simulated for demo.
// A real implementation would use route geometry from a routing API.
function estimateProgress(origin: string, destination: string): number {
  // Deterministic seeded value for demo — not random
  const seed = (origin.length + destination.length) % 10;
  return 35 + seed * 4; // between 35% and 75%
}

export default function LiveRoutePanel({
  driverId,
  shipmentId,
  origin,
  destination,
  eta,
}: LiveRoutePanelProps) {
  const [gps, setGps] = useState<GPSUpdate | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsPermission, setGpsPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const watchIdRef = useRef<number | null>(null);

  // Route progress for the visual tracker
  const progress = gps ? estimateProgress(origin, destination) : estimateProgress(origin, destination);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError('GPS not supported on this device.');
      setGpsPermission('denied');
      return;
    }

    const onSuccess = async (pos: GeolocationPosition) => {
      const update: GPSUpdate = {
        driverId,
        shipmentId,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed !== null
          ? Math.round((pos.coords.speed || 0) * 3.6) // m/s to km/h
          : undefined,
        heading: pos.coords.heading ?? undefined,
        timestamp: new Date(pos.timestamp).toISOString(),
        isStale: false,
      };

      setGps(update);
      setGpsPermission('granted');
      setGpsError(null);

      // 1. Write to Supabase Realtime (authoritative shared state)
      // 2. DB upsert (persistent)
      // 3. sessionStorage (local cache ONLY — never read by other interfaces)
      await publishGPSUpdate(update);
      try {
        sessionStorage.setItem('lonics_driver_gps_cache', JSON.stringify(update));
      } catch {
        // ignore storage errors
      }
    };

    const onError = (err: GeolocationPositionError) => {
      if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
        setGpsPermission('denied');
        setGpsError('Location permission denied. Grant access in browser settings.');
      } else {
        setGpsError(`GPS error: ${err.message}`);
      }
    };

    watchIdRef.current = navigator.geolocation.watchPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000,
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [driverId, shipmentId]);

  // Compute staleness every 15 seconds
  const [displayGps, setDisplayGps] = useState<GPSUpdate | null>(null);
  useEffect(() => {
    if (!gps) {
      setDisplayGps(null);
      return;
    }
    const update = () => {
      setDisplayGps({
        ...gps,
        isStale: isGPSStale(gps.timestamp),
      });
    };
    update();
    const interval = setInterval(update, 15000);
    return () => clearInterval(interval);
  }, [gps]);

  const isLive = displayGps && !displayGps.isStale;
  const isStale = displayGps && displayGps.isStale;

  return (
    <div className="bg-card border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-2.5">
          <Navigation className="h-4 w-4 text-primary" />
          <h3 className="font-bold text-sm text-foreground">Live Route</h3>
        </div>
        {/* GPS Status Badge */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${
          isLive
            ? 'bg-emerald-100 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400'
            : isStale
              ? 'bg-amber-100 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400'
              : 'bg-muted/50 border-border text-muted-foreground'
        }`}>
          {isLive
            ? <><Wifi className="h-3 w-3 animate-pulse" /> LIVE</>
            : isStale
              ? <><WifiOff className="h-3 w-3" /> STALE</>
              : gpsPermission === 'denied'
                ? <><WifiOff className="h-3 w-3" /> NO GPS</>
                : <><Wifi className="h-3 w-3" /> LOCATING...</>
          }
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Route Visualization */}
        <div className="space-y-3">
          {/* Origin label */}
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-sky-500 ring-2 ring-sky-300 dark:ring-sky-700 flex-shrink-0" />
            <span className="text-xs font-semibold text-foreground truncate">{origin}</span>
          </div>

          {/* Progress bar + truck icon */}
          <div className="relative h-2 bg-muted rounded-full mx-3 overflow-visible">
            <div
              className="absolute left-0 top-0 h-full bg-gradient-to-r from-sky-500 to-primary rounded-full transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
            {/* Truck marker */}
            <div
              className="absolute -top-3 -translate-x-1/2 transition-all duration-1000"
              style={{ left: `${progress}%` }}
              title={`${progress}% of route`}
            >
              <div className="h-8 w-8 flex items-center justify-center">
                <span className="text-lg" role="img" aria-label="truck">🚛</span>
              </div>
            </div>
            {/* Progress % label */}
            <div
              className="absolute -bottom-5 -translate-x-1/2 text-[9px] font-mono text-primary font-bold"
              style={{ left: `${progress}%` }}
            >
              {progress}%
            </div>
          </div>

          {/* Destination label */}
          <div className="flex items-center gap-2 mt-6">
            <div className="h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-emerald-300 dark:ring-emerald-700 flex-shrink-0" />
            <span className="text-xs font-semibold text-foreground truncate">{destination}</span>
          </div>
        </div>

        {/* GPS Data Row */}
        {displayGps ? (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted/30 rounded-xl p-2.5 border border-border/50">
              <Gauge className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
              <p className="text-[9px] font-mono uppercase text-muted-foreground">Speed</p>
              <p className="text-sm font-bold text-foreground">
                {displayGps.speed !== undefined ? `${displayGps.speed} km/h` : '—'}
              </p>
            </div>
            <div className="bg-muted/30 rounded-xl p-2.5 border border-border/50">
              <Clock className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
              <p className="text-[9px] font-mono uppercase text-muted-foreground">ETA</p>
              <p className="text-sm font-bold text-foreground">{eta}</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-2.5 border border-border/50">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
              <p className="text-[9px] font-mono uppercase text-muted-foreground">Accuracy</p>
              <p className="text-sm font-bold text-foreground">
                ±{Math.round(displayGps.accuracy)}m
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted/30 rounded-xl p-2.5 border border-border/50">
              <Clock className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
              <p className="text-[9px] font-mono uppercase text-muted-foreground">ETA</p>
              <p className="text-sm font-bold text-foreground">{eta}</p>
            </div>
            <div className="col-span-2 bg-muted/20 rounded-xl p-2.5 border border-dashed border-border/50 flex items-center justify-center">
              <p className="text-[10px] font-mono text-muted-foreground text-center">
                {gpsPermission === 'denied'
                  ? 'GPS access denied'
                  : 'Acquiring GPS signal...'}
              </p>
            </div>
          </div>
        )}

        {/* GPS Error */}
        {gpsError && (
          <div className="flex items-start gap-2 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 rounded-xl px-3 py-2.5">
            <WifiOff className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span>{gpsError}</span>
          </div>
        )}

        {/* Authoritative GPS note */}
        <p className="text-[9px] font-mono text-muted-foreground/60 text-center leading-relaxed">
          GPS position broadcast via Lonics Realtime · sessionStorage is local cache only
        </p>
      </div>
    </div>
  );
}
