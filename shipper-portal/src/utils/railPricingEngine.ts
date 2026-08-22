/**
 * Canonical Rail Pricing Engine for Lonics
 * 
 * Computes deterministic, traceable, route-aware Indian Railways container haulage freight
 * based on verified distance slabs, load weight bands, and container configurations.
 */

import {
  DISTANCE_SLAB_RATES,
  RAIL_CORRIDOR_REGISTRY,
  CANONICAL_TARIFF_METADATA,
  normalizeContainerConfig,
  resolveWeightBand,
} from "../data/railTariffData";
import type {
  ContainerConfigType,
  WeightBandKey,
  TariffMetadata,
  DistanceSlabRate,
} from "../data/railTariffData";

export interface CalculateFreightParams {
  originHub: string;
  originTerminal?: string;
  destinationHub: string;
  destinationTerminal?: string;
  chargeableDistanceKm?: number;
  containerType: string;
  cargoWeightTonnes?: number;
  // If quoting for a single shared LCL slot in a consolidated container
  isLCLSlot?: boolean;
  totalCapacitySlots?: number;
  // Optional verified commercial / terminal surcharges (default: 0)
  commercialChargesINR?: number;
  // Optional Lonics multimodal platform service fee (default: 0)
  lonicsServiceFeeINR?: number;
  // Optional override for custom tariff version testing
  tariffMetadata?: TariffMetadata;
  customSlabRates?: DistanceSlabRate[];
}

export interface RailPricingResult {
  totalFreight: number;
  currency: "INR";
  chargeableDistanceKm: number;
  distanceBandLabel: string;
  weightBandLabel: string;
  weightBandKey: WeightBandKey;
  containerType: ContainerConfigType;
  cargoWeightTonnes: number;
  baseContainerHaulage: number;
  slotHaulage: number;
  isLCLSlot: boolean;
  slotCapacity: number;
  commercialCharges: number;
  lonicsServiceFee: number;
  tariffMetadata: TariffMetadata;
  isEstimate: boolean;
  estimateLabel: string;
  calculatedAt: string;
  explanation: {
    route: string;
    distanceFormula: string;
    haulageRate: string;
    totalFormula: string;
  };
}

/**
 * Resolves chargeable rail distance between two hubs using the canonical registry.
 */
export function resolveChargeableDistance(
  origin: string,
  destination: string,
  explicitKm?: number
): { distanceKm: number; corridorName: string } {
  if (typeof explicitKm === "number" && explicitKm > 0) {
    return { distanceKm: explicitKm, corridorName: "Configured Rail Route" };
  }

  const o = (origin || "").toUpperCase();
  const d = (destination || "").toUpperCase();

  for (const profile of Object.values(RAIL_CORRIDOR_REGISTRY)) {
    const origMatch =
      o.includes(profile.originHub) || profile.originHub.includes(o);
    const destMatch =
      d.includes(profile.destinationHub) || profile.destinationHub.includes(d);

    if (origMatch && destMatch) {
      return {
        distanceKm: profile.chargeableDistanceKm,
        corridorName: profile.railCorridorName,
      };
    }
  }

  // Generic fallback if unknown pair (marked with fallback provenance)
  return { distanceKm: 1250, corridorName: "Standard National Rail Corridor" };
}

/**
 * Finds the applicable distance slab from the tariff dataset.
 */
export function findDistanceSlab(
  distanceKm: number,
  slabs: DistanceSlabRate[] = DISTANCE_SLAB_RATES
): DistanceSlabRate {
  const matched = slabs.find(
    (slab) => distanceKm >= slab.minKm && distanceKm <= slab.maxKm
  );
  if (matched) return matched;

  // If beyond highest slab, use the maximum slab
  return slabs[slabs.length - 1];
}

/**
 * Computes deterministic container haulage based on slab, weight band, and configuration.
 */
export function computeContainerBaseHaulage(
  slab: DistanceSlabRate,
  weightBand: WeightBandKey,
  config: ContainerConfigType
): number {
  let baseRate: number;

  if (config === "20FT_STANDARD" || config === "20FT_HIGH_CUBE") {
    baseRate = slab.rates20ft[weightBand] || slab.rates20ft["10-20t"];
    if (config === "20FT_HIGH_CUBE") {
      baseRate = Math.round(baseRate * 1.05); // High-cube tariff profile modifier
    }
  } else {
    // 40FT configurations
    baseRate = slab.rates40ft[weightBand] || slab.rates40ft["10-20t"];
    if (config === "40FT_REEFER") {
      baseRate = Math.round(baseRate * 1.25); // Reefer active power haulage modifier
    } else if (config === "40FT_HIGH_CUBE") {
      baseRate = Math.round(baseRate * 1.05);
    }
  }

  return baseRate;
}

/**
 * Canonical Rail Pricing Engine calculation function.
 */
export function calculateRailFreight(
  params: CalculateFreightParams
): RailPricingResult {
  const {
    originHub,
    destinationHub,
    chargeableDistanceKm,
    containerType,
    isLCLSlot = false,
    totalCapacitySlots = 20,
    commercialChargesINR = 0,
    lonicsServiceFeeINR = 0,
    tariffMetadata = CANONICAL_TARIFF_METADATA,
    customSlabRates = DISTANCE_SLAB_RATES,
  } = params;

  // 1. Resolve configuration and weights
  const config = normalizeContainerConfig(containerType);
  const defaultWeight = config.startsWith("20FT") ? 14.0 : 18.5;
  const cargoWeightTonnes =
    typeof params.cargoWeightTonnes === "number" && params.cargoWeightTonnes > 0
      ? params.cargoWeightTonnes
      : defaultWeight;

  const weightBandKey = resolveWeightBand(cargoWeightTonnes);

  // 2. Resolve corridor & chargeable distance
  const { distanceKm, corridorName } = resolveChargeableDistance(
    originHub,
    destinationHub,
    chargeableDistanceKm
  );

  // 3. Match distance tariff slab
  const slab = findDistanceSlab(distanceKm, customSlabRates);

  // 4. Calculate base container haulage
  const baseContainerHaulage = computeContainerBaseHaulage(
    slab,
    weightBandKey,
    config
  );

  // 5. Derive slot rate if quoting individual LCL booking slot
  const slotCount = Math.max(1, totalCapacitySlots);
  const slotHaulage = isLCLSlot
    ? Math.round(baseContainerHaulage / slotCount)
    : baseContainerHaulage;

  const applicableHaulage = isLCLSlot ? slotHaulage : baseContainerHaulage;

  // 6. Total = Base Haulage + Verified Commercial Surcharges + Lonics Service Fee
  const totalFreight =
    applicableHaulage + commercialChargesINR + lonicsServiceFeeINR;

  const weightBandLabel =
    weightBandKey === "0-10t"
      ? "Up to 10 t"
      : weightBandKey === "10-20t"
      ? "10–20 t"
      : weightBandKey === "20-26t"
      ? "20–26 t"
      : weightBandKey === "26-31t"
      ? "26–31 t"
      : "Over 31 t";

  return {
    totalFreight,
    currency: "INR",
    chargeableDistanceKm: distanceKm,
    distanceBandLabel: slab.label,
    weightBandLabel,
    weightBandKey,
    containerType: config,
    cargoWeightTonnes,
    baseContainerHaulage,
    slotHaulage,
    isLCLSlot,
    slotCapacity: slotCount,
    commercialCharges: commercialChargesINR,
    lonicsServiceFee: lonicsServiceFeeINR,
    tariffMetadata,
    isEstimate: true,
    estimateLabel: "Estimated Rail Freight · Tariff Based",
    calculatedAt: new Date().toISOString(),
    explanation: {
      route: `${originHub} → ${destinationHub} (${distanceKm.toLocaleString()} km · ${corridorName})`,
      distanceFormula: `Distance slab ${slab.label} × Weight category ${weightBandLabel}`,
      haulageRate: `Base Rail Haulage: ₹${applicableHaulage.toLocaleString()}${
        isLCLSlot ? ` (1/${slotCount} slot of ₹${baseContainerHaulage.toLocaleString()})` : ""
      }`,
      totalFormula: `₹${applicableHaulage.toLocaleString()} haulage + ₹${commercialChargesINR} terminal + ₹${lonicsServiceFeeINR} service = ₹${totalFreight.toLocaleString()}`,
    },
  };
}

/**
 * Format currency helper in Indian Numbering System (e.g. ₹70,600).
 */
export function formatINR(amount: number): string {
  return "₹" + Math.round(amount).toLocaleString("en-IN");
}
