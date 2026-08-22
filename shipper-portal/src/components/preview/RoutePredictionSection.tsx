import { useState, useEffect } from 'react';
import { TrendingUp, Cpu, Activity } from 'lucide-react';
import type { RoutePredictionData, ForecastPoint } from '../../data/previewData';
import PredictionForecastChart from './PredictionForecastChart';
import { getFreightForecast, getNetworkPressure } from '../../utils/api';

interface RoutePredictionSectionProps {
  prediction: RoutePredictionData;
}

export default function RoutePredictionSection({ prediction }: RoutePredictionSectionProps) {
  const [data, setData] = useState<RoutePredictionData>(prediction);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadLivePrediction() {
      try {
        const [freightRes, networkRes] = await Promise.allSettled([
          getFreightForecast(5),
          getNetworkPressure()
        ]);

        if (!isMounted) return;

        if (freightRes.status === 'fulfilled' && freightRes.value?.forecasts?.length) {
          const forecastData = freightRes.value;
          const histSlice = forecastData.historical.slice(-6).map((h) => ({
            month: h.fiscal_year.replace('FY ', ''),
            tonnage: h.freight_mt,
            isForecast: false,
          }));

          const forecastSlice: ForecastPoint[] = forecastData.forecasts.slice(0, 4).map((f) => ({
            month: f.forecast_period.replace('FY ', ''),
            tonnage: f.predicted_freight_mt,
            isForecast: true,
            lowerBound: f.prediction_interval?.lower,
            upperBound: f.prediction_interval?.upper,
          }));

          const nextForecast = forecastData.forecasts[0];
          const mapeVal = forecastData.model_metrics?.mape || 0.76;
          const confidence = Math.max(70, Math.min(99, Math.round(100 - mapeVal * 5)));
          
          let corridorName = 'National Freight Network (DFC)';
          if (networkRes.status === 'fulfilled' && networkRes.value?.score) {
            corridorName = `National Network (Pressure: ${networkRes.value.score}/100)`;
          }

          setData({
            corridor: corridorName,
            corridorTag: 'AI LIVE FORECAST',
            demandDeltaPercent: nextForecast?.growth_percent || 3.7,
            forecastTonnage: Math.round(nextForecast?.predicted_freight_mt || 1724),
            confidencePercent: confidence,
            recommendedWindow: 'Next Rail Window (7–10 days)',
            modelIdentifier: `AI-MODEL: ${forecastData.model.toUpperCase()} (MAPE ${mapeVal.toFixed(2)}%)`,
            series: [...histSlice, ...forecastSlice],
          });
          setIsLive(true);
        }
      } catch (e) {
        // Fallback to static mock seamlessly
        console.debug('Using fallback preview prediction data');
      }
    }

    loadLivePrediction();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="h-full flex flex-col justify-between bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm text-card-foreground">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] sm:text-xs font-mono font-semibold tracking-wider text-muted-foreground uppercase">
            AI Demand Forecast
          </span>
          {isLive && (
            <span className="flex items-center gap-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <Activity className="w-2.5 h-2.5 animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        <span className="font-mono text-xs font-bold text-foreground">
          {data.corridor}
        </span>
      </div>

      {/* 3 Glanceable Metric Badges */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 my-2">
        <div className="bg-muted/40 border border-border/70 rounded p-1.5 text-center">
          <div className="text-[9px] font-mono text-muted-foreground uppercase">Growth</div>
          <div className="text-xs sm:text-sm font-mono font-bold text-primary">
            ↑ {data.demandDeltaPercent}%
          </div>
        </div>

        <div className="bg-muted/40 border border-border/70 rounded p-1.5 text-center">
          <div className="text-[9px] font-mono text-muted-foreground uppercase">Forecast</div>
          <div className="text-xs sm:text-sm font-mono font-bold text-foreground">
            {data.forecastTonnage.toLocaleString()} MT
          </div>
        </div>

        <div className="bg-muted/40 border border-border/70 rounded p-1.5 text-center">
          <div className="text-[9px] font-mono text-muted-foreground uppercase">Confidence</div>
          <div className="text-xs sm:text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
            {data.confidencePercent}%
          </div>
        </div>
      </div>

      {/* Embedded Vector Forecast Chart */}
      <div className="w-full my-0.5">
        <PredictionForecastChart series={data.series} height={85} />
      </div>

      {/* Footer Model Telemetry */}
      <div className="flex items-center justify-between pt-1 text-[9px] sm:text-[10px] font-mono text-muted-foreground">
        <span className="flex items-center gap-1">
          <Cpu className="w-3 h-3 text-primary" />
          {data.modelIdentifier}
        </span>
        <span className="text-foreground/80">
          WINDOW: {data.recommendedWindow}
        </span>
      </div>
    </div>
  );
}
