import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Package, ShieldCheck, AlertCircle, Sparkles, Layers } from 'lucide-react';

export interface ContainerFillVisualizerProps {
  volumeCbm: number;
  maxVolumeCbm: number;
  massKg: number;
  maxMassKg: number;
  windowId: string;
  containerType?: string;
}

interface CargoBlock {
  id: string;
  x: number;
  y: number; // from top of interior floor (floor is y=225, ceiling is y=45)
  width: number;
  height: number;
  threshold: number; // Volume percentage at which this block appears
  batch: 'A' | 'B' | 'C' | 'D';
  batchName: string;
  code: string;
  cbm: number;
}

// 19 realistically positioned cargo units across 8 bay columns
const CARGO_BLOCKS: CargoBlock[] = [
  // Bay 1 (x: 42 to 122)
  { id: 'b1-1', x: 42, y: 155, width: 80, height: 68, threshold: 5, batch: 'A', batchName: 'Shipper 1: Automotive', code: 'P-101', cbm: 3.2 },
  { id: 'b1-2', x: 42, y: 95, width: 80, height: 56, threshold: 10, batch: 'A', batchName: 'Shipper 1: Automotive', code: 'CR-102', cbm: 2.6 },
  { id: 'b1-3', x: 42, y: 48, width: 80, height: 44, threshold: 16, batch: 'A', batchName: 'Shipper 1: Automotive', code: 'BX-103', cbm: 1.8 },

  // Bay 2 (x: 128 to 216)
  { id: 'b2-1', x: 128, y: 140, width: 88, height: 83, threshold: 22, batch: 'A', batchName: 'Shipper 1: Automotive', code: 'PL-201', cbm: 3.9 },
  { id: 'b2-2', x: 128, y: 55, width: 88, height: 81, threshold: 30, batch: 'B', batchName: 'Shipper 2: Electronics', code: 'CT-202', cbm: 3.4 },

  // Bay 3 (x: 222 to 300)
  { id: 'b3-1', x: 222, y: 162, width: 78, height: 61, threshold: 36, batch: 'B', batchName: 'Shipper 2: Electronics', code: 'EC-301', cbm: 2.5 },
  { id: 'b3-2', x: 222, y: 108, width: 78, height: 50, threshold: 42, batch: 'B', batchName: 'Shipper 2: Electronics', code: 'CT-302', cbm: 2.1 },
  { id: 'b3-3', x: 222, y: 52, width: 78, height: 52, threshold: 48, batch: 'B', batchName: 'Shipper 2: Electronics', code: 'CT-303', cbm: 2.0 },

  // Bay 4 (x: 306 to 398)
  { id: 'b4-1', x: 306, y: 135, width: 92, height: 88, threshold: 54, batch: 'C', batchName: 'Shipper 3: Precision Eng.', code: 'CR-401', cbm: 4.2 },
  { id: 'b4-2', x: 306, y: 58, width: 92, height: 73, threshold: 60, batch: 'C', batchName: 'Shipper 3: Precision Eng.', code: 'BX-402', cbm: 3.1 },

  // Bay 5 (x: 404 to 486)
  { id: 'b5-1', x: 404, y: 150, width: 82, height: 73, threshold: 66, batch: 'C', batchName: 'Shipper 3: Precision Eng.', code: 'PL-501', cbm: 3.2 },
  { id: 'b5-2', x: 404, y: 98, width: 82, height: 48, threshold: 72, batch: 'C', batchName: 'Shipper 3: Precision Eng.', code: 'BX-502', cbm: 2.2 },
  { id: 'b5-3', x: 404, y: 50, width: 82, height: 44, threshold: 76, batch: 'C', batchName: 'Shipper 3: Precision Eng.', code: 'PK-503', cbm: 1.7 },

  // Bay 6 (x: 492 to 578)
  { id: 'b6-1', x: 492, y: 138, width: 86, height: 85, threshold: 82, batch: 'D', batchName: 'Shipper 4: Industrial Materials', code: 'DR-601', cbm: 3.7 },
  { id: 'b6-2', x: 492, y: 62, width: 86, height: 72, threshold: 86, batch: 'D', batchName: 'Shipper 4: Industrial Materials', code: 'BX-602', cbm: 2.8 },

  // Bay 7 (x: 584 to 668)
  { id: 'b7-1', x: 584, y: 145, width: 84, height: 78, threshold: 90, batch: 'D', batchName: 'Shipper 4: Industrial Materials', code: 'PL-701', cbm: 3.1 },
  { id: 'b7-2', x: 584, y: 65, width: 84, height: 76, threshold: 94, batch: 'D', batchName: 'Shipper 4: Industrial Materials', code: 'CR-702', cbm: 2.7 },

  // Bay 8 (x: 674 to 756)
  { id: 'b8-1', x: 674, y: 142, width: 82, height: 81, threshold: 97, batch: 'C', batchName: 'Co-Load Buffer Batch', code: 'PL-801', cbm: 2.9 },
  { id: 'b8-2', x: 674, y: 68, width: 82, height: 70, threshold: 99, batch: 'C', batchName: 'Co-Load Buffer Batch', code: 'BX-802', cbm: 2.1 },
];

export const ContainerFillVisualizer: React.FC<ContainerFillVisualizerProps> = ({
  volumeCbm,
  maxVolumeCbm,
  massKg,
  maxMassKg,
  windowId,
  containerType = "40' High-Cube Intermodal Van",
}) => {
  const safeVolume = Math.max(0, volumeCbm);
  const safeMaxVolume = Math.max(1, maxVolumeCbm);
  const safeMass = Math.max(0, massKg);
  const safeMaxMass = Math.max(1, maxMassKg);

  const volumePercent = Math.min(100, Math.round((safeVolume / safeMaxVolume) * 100));
  const massPercent = Math.min(100, Math.round((safeMass / safeMaxMass) * 100));
  const availableVolumeCbm = Math.max(0, safeMaxVolume - safeVolume);
  const availableMassKg = Math.max(0, safeMaxMass - safeMass);

  // Operational Threshold State Determination
  const thresholdState = useMemo(() => {
    if (volumePercent >= 95 || massPercent >= 95) {
      return {
        label: 'CAPACITY LOCKED · AUTO-SPLIT NEXT WINDOW',
        style: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
        badge: 'CRITICAL',
        icon: AlertCircle,
        desc: 'Container has reached packing threshold limit. New consignments will route to next consolidation window.',
      };
    }
    if (volumePercent >= 82 || massPercent >= 85) {
      return {
        label: `${volumePercent}% UTILIZED · HIGH PACKING DENSITY`,
        style: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
        badge: 'NEAR FULL',
        icon: AlertCircle,
        desc: `Only ${availableVolumeCbm.toFixed(1)} CBM available before auto-seal cutoff.`,
      };
    }
    if (volumePercent >= 55) {
      return {
        label: `${volumePercent}% UTILIZED · OPTIMAL CO-LOAD PROFILE`,
        style: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
        badge: 'OPTIMAL',
        icon: ShieldCheck,
        desc: 'Volume and weight ratios aligned for standard freight rail departure.',
      };
    }
    return {
      label: `${volumePercent}% UTILIZED · ACCEPTING CONSOLIDATION CARGO`,
      style: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
      badge: 'ACCEPTING',
      icon: Sparkles,
      desc: `${availableVolumeCbm.toFixed(1)} CBM available for LCL co-loading and dimension matching.`,
    };
  }, [volumePercent, massPercent, availableVolumeCbm]);

  // Color theme generator for cargo batches
  const getBatchFill = (batch: 'A' | 'B' | 'C' | 'D') => {
    switch (batch) {
      case 'A':
        return {
          bg: 'fill-blue-600/35 dark:fill-blue-500/30',
          stroke: 'stroke-blue-500/70 dark:stroke-blue-400/80',
          text: 'fill-blue-700 dark:fill-blue-200',
          badgeBg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
        };
      case 'B':
        return {
          bg: 'fill-sky-500/35 dark:fill-sky-400/30',
          stroke: 'stroke-sky-500/70 dark:stroke-sky-400/80',
          text: 'fill-sky-700 dark:fill-sky-200',
          badgeBg: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
        };
      case 'C':
        return {
          bg: 'fill-cyan-600/35 dark:fill-cyan-400/30',
          stroke: 'stroke-cyan-500/70 dark:stroke-cyan-400/80',
          text: 'fill-cyan-700 dark:fill-cyan-200',
          badgeBg: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
        };
      case 'D':
        return {
          bg: 'fill-indigo-600/35 dark:fill-indigo-400/30',
          stroke: 'stroke-indigo-500/70 dark:stroke-indigo-400/80',
          text: 'fill-indigo-700 dark:fill-indigo-200',
          badgeBg: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
        };
    }
  };

  // Waterline position mapped to container width (x from 38 to 762 = 724px range)
  const waterlineX = 38 + (724 * (volumePercent / 100));

  return (
    <div className="w-full space-y-4 font-sans select-none">
      {/* Top Container Metadata & Operational State Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
            CONTAINER:
          </span>
          <span className="text-xs font-mono font-extrabold text-foreground px-2 py-0.5 rounded bg-muted/60 border border-slate-200 dark:border-zinc-800">
            {windowId}
          </span>
          <span className="hidden sm:inline text-[11px] font-mono text-muted-foreground">
            • {containerType}
          </span>
        </div>

        {/* Operational State Pill */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono font-bold uppercase tracking-wider ${thresholdState.style}`}>
          <thresholdState.icon className="h-3 w-3 shrink-0" />
          <span>{thresholdState.label}</span>
        </div>
      </div>

      {/* Main Container Cross-Section Canvas */}
      <div className="relative w-full bg-background border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-inner p-2 sm:p-3">
        {/* SVG Container Visualizer */}
        <div className="w-full aspect-[2.7/1] min-h-[160px] sm:min-h-[190px]">
          <svg
            viewBox="0 0 800 270"
            className="w-full h-full"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              {/* Pattern for floor load ribs */}
              <pattern id="floor-ribs" width="16" height="12" patternUnits="userSpaceOnUse">
                <line x1="0" y1="6" x2="16" y2="6" className="stroke-slate-300 dark:stroke-zinc-700" strokeWidth="1" />
                <line x1="8" y1="0" x2="8" y2="12" className="stroke-slate-300 dark:stroke-zinc-800" strokeWidth="0.5" />
              </pattern>

              {/* Pattern for unoccupied container space */}
              <pattern id="empty-chamber-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" className="stroke-slate-200/50 dark:stroke-zinc-800/40" strokeWidth="0.5" strokeDasharray="2,2" />
              </pattern>

              {/* Subtle crate texture overlay */}
              <pattern id="crate-texture" width="10" height="10" patternUnits="userSpaceOnUse">
                <line x1="0" y1="10" x2="10" y2="0" className="stroke-white/10 dark:stroke-black/15" strokeWidth="0.75" />
              </pattern>
            </defs>

            {/* ── 1. CONTAINER OUTER SHELL & CORNER CASTINGS ── */}
            {/* Main Outer Wall */}
            <rect
              x="20"
              y="25"
              width="760"
              height="215"
              rx="6"
              className="fill-slate-100/70 dark:fill-zinc-900/60 stroke-slate-300 dark:stroke-zinc-700"
              strokeWidth="2"
            />

            {/* Container Interior Chamber */}
            <rect
              x="36"
              y="40"
              width="728"
              height="186"
              className="fill-background stroke-slate-200 dark:stroke-zinc-800"
              strokeWidth="1"
            />

            {/* Empty Chamber Grid Pattern Background */}
            <rect
              x="36"
              y="40"
              width="728"
              height="186"
              fill="url(#empty-chamber-grid)"
            />

            {/* Corner Castings (ISO Twistlock Blocks) */}
            {/* Top-Left */}
            <rect x="20" y="25" width="16" height="16" rx="2" className="fill-slate-300 dark:fill-zinc-700 stroke-slate-400 dark:stroke-zinc-600" strokeWidth="1" />
            <ellipse cx="28" cy="33" rx="4" ry="2.5" className="fill-background" />

            {/* Top-Right */}
            <rect x="764" y="25" width="16" height="16" rx="2" className="fill-slate-300 dark:fill-zinc-700 stroke-slate-400 dark:stroke-zinc-600" strokeWidth="1" />
            <ellipse cx="772" cy="33" rx="4" ry="2.5" className="fill-background" />

            {/* Bottom-Left */}
            <rect x="20" y="224" width="16" height="16" rx="2" className="fill-slate-300 dark:fill-zinc-700 stroke-slate-400 dark:stroke-zinc-600" strokeWidth="1" />
            <ellipse cx="28" cy="232" rx="4" ry="2.5" className="fill-background" />

            {/* Bottom-Right */}
            <rect x="764" y="224" width="16" height="16" rx="2" className="fill-slate-300 dark:fill-zinc-700 stroke-slate-400 dark:stroke-zinc-600" strokeWidth="1" />
            <ellipse cx="772" cy="232" rx="4" ry="2.5" className="fill-background" />

            {/* Left Bulkhead (Front End Corrugation) */}
            <rect x="24" y="41" width="12" height="183" className="fill-slate-200 dark:fill-zinc-800/80" />
            <line x1="30" y1="45" x2="30" y2="220" className="stroke-slate-300 dark:stroke-zinc-700" strokeWidth="1" />

            {/* Right Door Frame (Rear Opening) */}
            <rect x="764" y="41" width="12" height="183" className="fill-slate-200 dark:fill-zinc-800/80" />
            <line x1="770" y1="45" x2="770" y2="220" className="stroke-slate-300 dark:stroke-zinc-700" strokeWidth="1" />

            {/* Floor Slat Bed */}
            <rect x="36" y="214" width="728" height="12" fill="url(#floor-ribs)" />
            <line x1="36" y1="214" x2="764" y2="214" className="stroke-slate-300 dark:stroke-zinc-700" strokeWidth="1" />

            {/* Ceiling Tie-down Track */}
            <line x1="36" y1="48" x2="764" y2="48" className="stroke-slate-200 dark:stroke-zinc-800" strokeWidth="1" strokeDasharray="6,4" />

            {/* ── 2. INTERNAL CAPACITY THRESHOLD GUIDELINES ── */}
            {/* 25% guideline */}
            <line x1="219" y1="40" x2="219" y2="214" className="stroke-slate-200 dark:stroke-zinc-800" strokeWidth="1" strokeDasharray="3,3" />
            <text x="219" y="36" textAnchor="middle" className="fill-slate-400 dark:fill-zinc-500 font-mono text-[8px]">25%</text>

            {/* 50% midpoint guideline */}
            <line x1="400" y1="40" x2="400" y2="214" className="stroke-slate-200 dark:stroke-zinc-800" strokeWidth="1" strokeDasharray="3,3" />
            <text x="400" y="36" textAnchor="middle" className="fill-slate-400 dark:fill-zinc-500 font-mono text-[8px]">50% (MID)</text>

            {/* 75% guideline */}
            <line x1="582" y1="40" x2="582" y2="214" className="stroke-slate-200 dark:stroke-zinc-800" strokeWidth="1" strokeDasharray="3,3" />
            <text x="582" y="36" textAnchor="middle" className="fill-slate-400 dark:fill-zinc-500 font-mono text-[8px]">75%</text>

            {/* 85% Optimal packing cutoff */}
            <line x1="653" y1="40" x2="653" y2="214" className="stroke-amber-500/40" strokeWidth="1" strokeDasharray="2,2" />
            <text x="653" y="36" textAnchor="middle" className="fill-amber-500/80 font-mono text-[8px] font-bold">85% TARGET</text>

            {/* ── 3. DATA-DRIVEN CARGO BLOCKS ── */}
            {CARGO_BLOCKS.map((block) => {
              const isLoaded = volumePercent >= block.threshold;
              const style = getBatchFill(block.batch);

              if (!isLoaded) return null;

              return (
                <g key={block.id} className="transition-all duration-300">
                  {/* Cargo Block Body */}
                  <rect
                    x={block.x}
                    y={block.y}
                    width={block.width}
                    height={block.height}
                    rx="3"
                    className={`${style.bg} ${style.stroke}`}
                    strokeWidth="1.25"
                  />

                  {/* Micro texture overlay */}
                  <rect
                    x={block.x}
                    y={block.y}
                    width={block.width}
                    height={block.height}
                    rx="3"
                    fill="url(#crate-texture)"
                  />

                  {/* Pallet Base Slat (if it's a bottom block) */}
                  {block.y + block.height >= 210 && (
                    <rect
                      x={block.x + 2}
                      y={block.y + block.height - 5}
                      width={block.width - 4}
                      height="4"
                      className="fill-amber-700/40 dark:fill-amber-500/30"
                      rx="1"
                    />
                  )}

                  {/* Security Strap / Corner Ribbon */}
                  <line
                    x1={block.x + 8}
                    y1={block.y}
                    x2={block.x + 8}
                    y2={block.y + block.height}
                    className="stroke-black/10 dark:stroke-white/10"
                    strokeWidth="1"
                  />
                  <line
                    x1={block.x + block.width - 8}
                    y1={block.y}
                    x2={block.x + block.width - 8}
                    y2={block.y + block.height}
                    className="stroke-black/10 dark:stroke-white/10"
                    strokeWidth="1"
                  />

                  {/* Package Code Label */}
                  <text
                    x={block.x + block.width / 2}
                    y={block.y + block.height / 2 + 3}
                    textAnchor="middle"
                    className={`font-mono text-[9px] font-bold ${style.text}`}
                  >
                    {block.code}
                  </text>

                  {/* Package CBM size micro-label */}
                  {block.height > 55 && (
                    <text
                      x={block.x + block.width / 2}
                      y={block.y + block.height / 2 + 13}
                      textAnchor="middle"
                      className="font-mono text-[7px] fill-muted-foreground/80"
                    >
                      {block.cbm} CBM
                    </text>
                  )}
                </g>
              );
            })}

            {/* ── 4. DYNAMIC FILL LEVEL WATERLINE ── */}
            {volumePercent > 0 && volumePercent < 100 && (
              <g className="transition-all duration-500">
                {/* Vertical Fill Front Line */}
                <line
                  x1={waterlineX}
                  y1="40"
                  x2={waterlineX}
                  y2="214"
                  className="stroke-primary"
                  strokeWidth="1.5"
                  strokeDasharray="4,2"
                />

                {/* Top Arrow Pointer */}
                <polygon
                  points={`${waterlineX - 4},38 ${waterlineX + 4},38 ${waterlineX},44`}
                  className="fill-primary"
                />

                {/* Bottom Pointer */}
                <polygon
                  points={`${waterlineX - 4},216 ${waterlineX + 4},216 ${waterlineX},210`}
                  className="fill-primary"
                />
              </g>
            )}

            {/* Unoccupied Buffer Space Label (when there is available space) */}
            {availableVolumeCbm >= 2.0 && (
              <g className="transition-opacity duration-300">
                <rect
                  x={Math.max(420, Math.min(620, waterlineX + 15))}
                  y="105"
                  width="135"
                  height="34"
                  rx="4"
                  className="fill-background/85 stroke-slate-300/80 dark:stroke-zinc-700/80 backdrop-blur-sm"
                  strokeWidth="1"
                />
                <text
                  x={Math.max(420, Math.min(620, waterlineX + 15)) + 67}
                  y="119"
                  textAnchor="middle"
                  className="font-mono text-[8px] font-bold fill-primary uppercase tracking-wider"
                >
                  +{availableVolumeCbm.toFixed(1)} CBM AVAILABLE
                </text>
                <text
                  x={Math.max(420, Math.min(620, waterlineX + 15)) + 67}
                  y="131"
                  textAnchor="middle"
                  className="font-mono text-[7px] fill-muted-foreground uppercase"
                >
                  {100 - volumePercent}% Unoccupied Space
                </text>
              </g>
            )}

            {/* Container Base Footnotes */}
            <text x="42" y="258" className="font-mono text-[8px] fill-muted-foreground uppercase">
              FRONT BULKHEAD (GATE-1)
            </text>
            <text x="400" y="258" textAnchor="middle" className="font-mono text-[8px] fill-muted-foreground uppercase">
              MAX CUBIC CAPACITY: {safeMaxVolume.toFixed(1)} CBM • TARE: 3,820 KG
            </text>
            <text x="758" y="258" textAnchor="end" className="font-mono text-[8px] fill-muted-foreground uppercase">
              REAR DISPATCH DOORS
            </text>
          </svg>
        </div>
      </div>

      {/* Shipper Consignments Legend & Dual Utilization Cards */}
      <div className="space-y-3">
        {/* Consignment Batches Co-Load Legend */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-muted-foreground">
            <Layers className="h-3.5 w-3.5 text-primary" />
            <span>Consolidated Consignments:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <span className="h-2 w-2 rounded-sm bg-blue-500" />
              Automotive Parts (7.6 CBM)
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              <span className="h-2 w-2 rounded-sm bg-sky-500" />
              Electronics (7.5 CBM)
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              <span className="h-2 w-2 rounded-sm bg-cyan-500" />
              Precision Engineering (9.0 CBM)
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <span className="h-2 w-2 rounded-sm bg-indigo-500" />
              Industrial Buffer (6.5 CBM)
            </span>
          </div>
        </div>

        {/* Dual Primary Metric Cards: Volume vs Payload */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* CARD 1: Volumetric Utilization */}
          <div className="bg-background/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 space-y-2">
            <div className="flex justify-between items-start">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Package className="h-3.5 w-3.5 text-primary" />
                  <span>Volumetric Utilization</span>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono">
                  Packing space occupied
                </p>
              </div>

              <div className="text-right">
                <span className="text-base font-black font-mono text-primary">
                  {volumePercent}%
                </span>
                <p className="text-[10px] font-mono text-muted-foreground">
                  {safeVolume.toFixed(1)} / {safeMaxVolume.toFixed(1)} CBM
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="relative h-2 w-full bg-muted/60 rounded-full overflow-hidden border border-slate-200 dark:border-zinc-800">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-600 via-primary to-sky-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${volumePercent}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
              <div
                className="absolute top-0 bottom-0 left-[80%] w-0.5 bg-amber-500/60"
                title="80% Target Packing Threshold"
              />
            </div>

            <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground pt-0.5">
              <span>Remaining: <strong className="text-foreground">{availableVolumeCbm.toFixed(1)} CBM</strong></span>
              <span>Packing Target: 80%</span>
            </div>
          </div>

          {/* CARD 2: Gross Payload Mass Constraint */}
          <div className="bg-background/80 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 space-y-2">
            <div className="flex justify-between items-start">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Layers className="h-3.5 w-3.5 text-sky-500" />
                  <span>Gross Payload Mass</span>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono">
                  Axle weight loading margin
                </p>
              </div>

              <div className="text-right">
                <span className="text-base font-black font-mono text-sky-600 dark:text-sky-400">
                  {massPercent}%
                </span>
                <p className="text-[10px] font-mono text-muted-foreground">
                  {(safeMass / 1000).toFixed(1)}T / {(safeMaxMass / 1000).toFixed(1)}T ({safeMass.toLocaleString()} KG)
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="relative h-2 w-full bg-muted/60 rounded-full overflow-hidden border border-slate-200 dark:border-zinc-800">
              <motion.div
                className="h-full bg-gradient-to-r from-sky-600 to-cyan-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${massPercent}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
              <div
                className="absolute top-0 bottom-0 left-[85%] w-0.5 bg-rose-500/60"
                title="85% Axle Rating Limit"
              />
            </div>

            <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground pt-0.5">
              <span>Remaining: <strong className="text-foreground">{(availableMassKg / 1000).toFixed(1)}T ({(availableMassKg).toLocaleString()} KG)</strong></span>
              <span>Axle Limit: 85%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContainerFillVisualizer;
