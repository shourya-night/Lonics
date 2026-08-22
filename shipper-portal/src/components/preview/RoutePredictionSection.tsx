import { TrendingUp, Cpu } from 'lucide-react';
import type { RoutePredictionData } from '../../data/previewData';
import PredictionForecastChart from './PredictionForecastChart';

interface RoutePredictionSectionProps {
  prediction: RoutePredictionData;
}

export default function RoutePredictionSection({ prediction }: RoutePredictionSectionProps) {
  return (
    <div className="h-full flex flex-col justify-between bg-card border border-border rounded-lg p-3 sm:p-4 shadow-sm text-card-foreground">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] sm:text-xs font-mono font-semibold tracking-wider text-muted-foreground uppercase">
            Route Prediction
          </span>
        </div>
        <span className="font-mono text-xs font-bold text-foreground">
          {prediction.corridor}
        </span>
      </div>

      {/* 3 Glanceable Metric Badges */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 my-2">
        <div className="bg-muted/40 border border-border/70 rounded p-1.5 text-center">
          <div className="text-[9px] font-mono text-muted-foreground uppercase">Demand</div>
          <div className="text-xs sm:text-sm font-mono font-bold text-primary">
            ↑ {prediction.demandDeltaPercent}%
          </div>
        </div>

        <div className="bg-muted/40 border border-border/70 rounded p-1.5 text-center">
          <div className="text-[9px] font-mono text-muted-foreground uppercase">Forecast</div>
          <div className="text-xs sm:text-sm font-mono font-bold text-foreground">
            {prediction.forecastTonnage.toLocaleString()} MT
          </div>
        </div>

        <div className="bg-muted/40 border border-border/70 rounded p-1.5 text-center">
          <div className="text-[9px] font-mono text-muted-foreground uppercase">Confidence</div>
          <div className="text-xs sm:text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
            {prediction.confidencePercent}%
          </div>
        </div>
      </div>

      {/* Embedded Vector Forecast Chart */}
      <div className="w-full my-0.5">
        <PredictionForecastChart series={prediction.series} height={85} />
      </div>

      {/* Footer Model Telemetry */}
      <div className="flex items-center justify-between pt-1 text-[9px] sm:text-[10px] font-mono text-muted-foreground">
        <span className="flex items-center gap-1">
          <Cpu className="w-3 h-3 text-primary" />
          {prediction.modelIdentifier}
        </span>
        <span className="text-foreground/80">
          WINDOW: {prediction.recommendedWindow}
        </span>
      </div>
    </div>
  );
}
