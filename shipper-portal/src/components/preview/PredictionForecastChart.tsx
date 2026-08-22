import { useState, useMemo, useId } from 'react';
import type { ForecastPoint } from '../../data/previewData';

interface PredictionForecastChartProps {
  series: ForecastPoint[];
  height?: number;
}

export default function PredictionForecastChart({ series, height = 110 }: PredictionForecastChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const chartId = useId();

  const minTonnage = 700;
  const maxTonnage = 1500;
  const paddingX = 24;
  const paddingY = 16;
  const viewBoxWidth = 420;
  const viewBoxHeight = height;

  const chartWidth = viewBoxWidth - paddingX * 2;
  const chartHeight = viewBoxHeight - paddingY * 2;

  // Calculate coordinates
  const points = useMemo(() => {
    return series.map((pt, idx) => {
      const x = paddingX + (idx / (series.length - 1)) * chartWidth;
      const normalizedY = (pt.tonnage - minTonnage) / (maxTonnage - minTonnage);
      const y = viewBoxHeight - paddingY - normalizedY * chartHeight;

      let upperY = y;
      let lowerY = y;
      if (pt.upperBound && pt.lowerBound) {
        const normUpper = (pt.upperBound - minTonnage) / (maxTonnage - minTonnage);
        const normLower = (pt.lowerBound - minTonnage) / (maxTonnage - minTonnage);
        upperY = viewBoxHeight - paddingY - normUpper * chartHeight;
        lowerY = viewBoxHeight - paddingY - normLower * chartHeight;
      }

      return { ...pt, x, y, upperY, lowerY, idx };
    });
  }, [series, chartWidth, chartHeight, viewBoxHeight]);

  // Separate historical and forecast indices
  const historicalPoints = points.filter((p) => !p.isForecast);
  const forecastPoints = points.filter((p) => p.isForecast);
  const junctionPoint = historicalPoints[historicalPoints.length - 1];
  const fullForecastPoints = junctionPoint ? [junctionPoint, ...forecastPoints] : forecastPoints;

  // Build SVG path strings
  const historicalPath = historicalPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '');
  const forecastPath = fullForecastPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '');

  // Confidence area path
  const confidenceAreaPath = useMemo(() => {
    if (fullForecastPoints.length < 2) return '';
    const topPath = fullForecastPoints.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.upperY.toFixed(1)}`, '');
    const bottomPath = [...fullForecastPoints].reverse().reduce((acc, p) => `${acc} L ${p.x.toFixed(1)} ${p.lowerY.toFixed(1)}`, '');
    return `${topPath} ${bottomPath} Z`;
  }, [fullForecastPoints]);

  const activePoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  return (
    <div className="relative w-full select-none" onMouseLeave={() => setHoveredIndex(null)}>
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
        className="w-full h-auto overflow-visible"
        aria-label="Route Demand Prediction Chart"
      >
        <defs>
          <linearGradient id={`${chartId}-conf-grad`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.16" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {/* Horizontal guide lines inheriting border token */}
        {[800, 1100, 1400].map((level) => {
          const norm = (level - minTonnage) / (maxTonnage - minTonnage);
          const y = viewBoxHeight - paddingY - norm * chartHeight;
          return (
            <g key={level}>
              <line
                x1={paddingX}
                y1={y}
                x2={viewBoxWidth - paddingX}
                y2={y}
                stroke="currentColor"
                strokeDasharray="2 3"
                strokeWidth="1"
                className="text-border"
              />
              <text
                x={paddingX - 4}
                y={y + 3}
                fill="currentColor"
                fontSize="8"
                textAnchor="end"
                fontFamily="monospace"
                className="text-muted-foreground"
              >
                {level}
              </text>
            </g>
          );
        })}

        {/* Forecast Horizon Divider */}
        {junctionPoint && (
          <g>
            <line
              x1={junctionPoint.x}
              y1={paddingY}
              x2={junctionPoint.x}
              y2={viewBoxHeight - paddingY}
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="2 2"
              className="text-primary/40"
            />
            <text
              x={junctionPoint.x - 4}
              y={paddingY + 8}
              fill="currentColor"
              fontSize="7.5"
              textAnchor="end"
              fontFamily="monospace"
              fontWeight="600"
              className="text-muted-foreground"
            >
              HISTORICAL
            </text>
            <text
              x={junctionPoint.x + 4}
              y={paddingY + 8}
              fill="currentColor"
              fontSize="7.5"
              textAnchor="start"
              fontFamily="monospace"
              fontWeight="600"
              className="text-primary"
            >
              FORECAST
            </text>
          </g>
        )}

        {/* Confidence Band Area for Forecast */}
        {confidenceAreaPath && (
          <path
            d={confidenceAreaPath}
            fill={`url(#${chartId}-conf-grad)`}
            className="text-primary"
          />
        )}

        {/* Historical Line */}
        <path
          d={historicalPath}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary"
        />

        {/* Forecast Dashed Line */}
        <path
          d={forecastPath}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="4 3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary/75"
        />

        {/* Data Nodes & Hit Targets */}
        {points.map((p, idx) => {
          const isHovered = hoveredIndex === idx;
          return (
            <g
              key={p.month}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIndex(idx)}
            >
              {/* Invisible expanded hit circle */}
              <circle cx={p.x} cy={p.y} r="12" fill="transparent" />

              {/* Node point */}
              <circle
                cx={p.x}
                cy={p.y}
                r={isHovered ? 4.5 : p.isForecast ? 3 : 2.5}
                fill="currentColor"
                stroke="currentColor"
                strokeWidth={isHovered ? 2 : 1}
                className={`transition-all duration-150 ${
                  isHovered
                    ? 'text-foreground'
                    : p.isForecast
                    ? 'text-primary'
                    : 'text-primary/80'
                }`}
              />

              {/* Month label along x-axis */}
              <text
                x={p.x}
                y={viewBoxHeight - 3}
                fill="currentColor"
                fontSize="8"
                textAnchor="middle"
                fontFamily="monospace"
                fontWeight={isHovered || p.isForecast ? '600' : '400'}
                className={isHovered ? 'text-primary font-bold' : 'text-muted-foreground'}
              >
                {p.month}
              </text>
            </g>
          );
        })}

        {/* Active hover crosshair */}
        {activePoint && (
          <g>
            <line
              x1={activePoint.x}
              y1={paddingY}
              x2={activePoint.x}
              y2={viewBoxHeight - paddingY}
              stroke="currentColor"
              strokeWidth="0.75"
              strokeDasharray="1 2"
              className="text-foreground/60"
            />
          </g>
        )}
      </svg>

      {/* Floating Hover Tooltip using Popover theme tokens */}
      {activePoint && (
        <div
          className="absolute z-10 pointer-events-none transform -translate-x-1/2 -translate-y-full bg-popover text-popover-foreground border border-border px-2 py-1 rounded shadow-md backdrop-blur-sm transition-all text-left"
          style={{
            left: `${(activePoint.x / viewBoxWidth) * 100}%`,
            top: `${(activePoint.y / viewBoxHeight) * 100 - 6}%`,
          }}
        >
          <div className="flex items-center gap-1.5 font-mono text-[9px] text-muted-foreground leading-tight">
            <span>{activePoint.month} 2026</span>
            <span>•</span>
            <span className={activePoint.isForecast ? 'text-primary font-bold' : 'text-muted-foreground'}>
              {activePoint.isForecast ? 'PREDICTED' : 'HISTORICAL'}
            </span>
          </div>
          <div className="font-mono text-xs font-bold text-foreground">
            {activePoint.tonnage.toLocaleString()} MT
          </div>
        </div>
      )}
    </div>
  );
}
