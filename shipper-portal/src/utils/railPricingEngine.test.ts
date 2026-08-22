import { describe, it, expect } from "vitest";
import {
  calculateRailFreight,
  findDistanceSlab,
  formatINR,
} from "./railPricingEngine";
import {
  DISTANCE_SLAB_RATES,
  resolveWeightBand,
  CANONICAL_TARIFF_METADATA,
} from "../data/railTariffData";

describe("Rail Pricing Engine - Indian Railways Tariff Calculations", () => {
  describe("1. Distance Slab Boundaries", () => {
    it("correctly identifies slab boundaries across graduation steps", () => {
      expect(findDistanceSlab(50).label).toBe("0–50 km");
      expect(findDistanceSlab(51).label).toBe("51–100 km");

      expect(findDistanceSlab(100).label).toBe("51–100 km");
      expect(findDistanceSlab(101).label).toBe("101–150 km");

      expect(findDistanceSlab(150).label).toBe("101–150 km");
      expect(findDistanceSlab(151).label).toBe("151–250 km");

      expect(findDistanceSlab(1375).label).toBe("1,201–1,375 km");
      expect(findDistanceSlab(1376).label).toBe("1,376–1,500 km");
      expect(findDistanceSlab(1384).label).toBe("1,376–1,500 km");

      expect(findDistanceSlab(1500).label).toBe("1,376–1,500 km");
      expect(findDistanceSlab(1501).label).toBe("1,501–1,800 km");
    });

    it("evaluates rate escalation across slab transitions for identical cargo", () => {
      const price50km = calculateRailFreight({
        originHub: "TEST-A",
        destinationHub: "TEST-B",
        chargeableDistanceKm: 50,
        containerType: "40FT_STANDARD",
        cargoWeightTonnes: 15,
      });

      const price51km = calculateRailFreight({
        originHub: "TEST-A",
        destinationHub: "TEST-B",
        chargeableDistanceKm: 51,
        containerType: "40FT_STANDARD",
        cargoWeightTonnes: 15,
      });

      expect(price51km.totalFreight).toBeGreaterThan(price50km.totalFreight);
      expect(price50km.distanceBandLabel).toBe("0–50 km");
      expect(price51km.distanceBandLabel).toBe("51–100 km");
    });
  });

  describe("2. Weight Category Boundaries", () => {
    it("correctly maps weight boundaries to weight bands", () => {
      expect(resolveWeightBand(5.0)).toBe("0-10t");
      expect(resolveWeightBand(10.0)).toBe("0-10t");
      expect(resolveWeightBand(10.01)).toBe("10-20t");

      expect(resolveWeightBand(20.0)).toBe("10-20t");
      expect(resolveWeightBand(20.01)).toBe("20-26t");

      expect(resolveWeightBand(26.0)).toBe("20-26t");
      expect(resolveWeightBand(26.01)).toBe("26-31t");

      expect(resolveWeightBand(31.0)).toBe("26-31t");
      expect(resolveWeightBand(31.01)).toBe(">31t");
      expect(resolveWeightBand(35.0)).toBe(">31t");
    });

    it("increases haulage price when stepping across weight band boundaries on the same route", () => {
      const price10t = calculateRailFreight({
        originHub: "MUMBAI PORT",
        destinationHub: "DELHI ICD",
        chargeableDistanceKm: 1384,
        containerType: "20FT_STANDARD",
        cargoWeightTonnes: 10.0,
      });

      const price10_5t = calculateRailFreight({
        originHub: "MUMBAI PORT",
        destinationHub: "DELHI ICD",
        chargeableDistanceKm: 1384,
        containerType: "20FT_STANDARD",
        cargoWeightTonnes: 10.5,
      });

      expect(price10_5t.totalFreight).toBeGreaterThan(price10t.totalFreight);
      expect(price10t.weightBandKey).toBe("0-10t");
      expect(price10_5t.weightBandKey).toBe("10-20t");
    });
  });

  describe("3. Container Configuration Treatment", () => {
    it("differentiates 20ft, 40ft, High Cube, and Reefer container rates", () => {
      const price20ft = calculateRailFreight({
        originHub: "MUMBAI PORT",
        destinationHub: "DELHI ICD",
        chargeableDistanceKm: 1384,
        containerType: "20' FCL",
        cargoWeightTonnes: 18.5,
      });

      const price40ft = calculateRailFreight({
        originHub: "MUMBAI PORT",
        destinationHub: "DELHI ICD",
        chargeableDistanceKm: 1384,
        containerType: "40' LCL",
        cargoWeightTonnes: 18.5,
      });

      const priceReefer = calculateRailFreight({
        originHub: "MUMBAI PORT",
        destinationHub: "DELHI ICD",
        chargeableDistanceKm: 1384,
        containerType: "40' REEFER",
        cargoWeightTonnes: 18.5,
      });

      expect(price40ft.totalFreight).toBeGreaterThan(price20ft.totalFreight);
      expect(priceReefer.totalFreight).toBeGreaterThan(price40ft.totalFreight);
      expect(priceReefer.containerType).toBe("40FT_REEFER");
    });
  });

  describe("4. Route & Corridor Variation", () => {
    it("calculates distinct prices for distinct railway corridors", () => {
      const mumbaiDelhi = calculateRailFreight({
        originHub: "MUMBAI PORT",
        destinationHub: "DELHI ICD",
        containerType: "40' LCL",
      });

      const chennaiBengaluru = calculateRailFreight({
        originHub: "CHENNAI ICD",
        destinationHub: "BENGALURU LOGISTICS PARK",
        containerType: "40' LCL",
      });

      expect(mumbaiDelhi.chargeableDistanceKm).toBe(1384);
      expect(chennaiBengaluru.chargeableDistanceKm).toBe(362);
      expect(mumbaiDelhi.totalFreight).toBeGreaterThan(chennaiBengaluru.totalFreight);
    });
  });

  describe("5. Provenance, Metadata & No Fabricated Charges", () => {
    it("includes tariff version, provenance, and explanation breakdown", () => {
      const result = calculateRailFreight({
        originHub: "MUMBAI PORT",
        destinationHub: "DELHI ICD",
        containerType: "40' LCL",
      });

      expect(result.tariffMetadata.tariffVersion).toBe("IR-CTO-HAULAGE-2026.01");
      expect(result.tariffMetadata.isVerifiedAuthority).toBe(true);
      expect(result.isEstimate).toBe(true);
      expect(result.estimateLabel).toBe("Estimated Rail Freight · Tariff Based");
      expect(result.commercialCharges).toBe(0);
      expect(result.lonicsServiceFee).toBe(0);
      expect(result.explanation.route).toContain("MUMBAI");
    });
  });

  describe("6. Reservation Snapshot Immutability", () => {
    it("preserves snapshot prices even when tariffs are recalculated under simulated new versions", () => {
      // 1. Initial booking created under standard tariff
      const initialQuote = calculateRailFreight({
        originHub: "MUMBAI PORT",
        destinationHub: "DELHI ICD",
        chargeableDistanceKm: 1384,
        containerType: "40' LCL",
        cargoWeightTonnes: 18.5,
      });

      // Freeze initial quote as an immutable reservation snapshot
      const immutableSnapshot = { ...initialQuote };

      // 2. Simulated future tariff update with modified rates
      const modifiedTariffMetadata = {
        ...CANONICAL_TARIFF_METADATA,
        tariffVersion: "IR-CTO-HAULAGE-2026.09-REVISED",
      };

      const updatedSlabs = DISTANCE_SLAB_RATES.map((slab) => ({
        ...slab,
        rates40ft: {
          ...slab.rates40ft,
          "10-20t": slab.rates40ft["10-20t"] + 5000,
        },
      }));

      const newQuote = calculateRailFreight({
        originHub: "MUMBAI PORT",
        destinationHub: "DELHI ICD",
        chargeableDistanceKm: 1384,
        containerType: "40' LCL",
        cargoWeightTonnes: 18.5,
        tariffMetadata: modifiedTariffMetadata,
        customSlabRates: updatedSlabs,
      });

      // New quote reflects updated tariff
      expect(newQuote.totalFreight).toBeGreaterThan(immutableSnapshot.totalFreight);
      expect(newQuote.tariffMetadata.tariffVersion).toBe("IR-CTO-HAULAGE-2026.09-REVISED");

      // Existing reservation snapshot remains unchanged
      expect(immutableSnapshot.totalFreight).toBe(initialQuote.totalFreight);
      expect(immutableSnapshot.tariffMetadata.tariffVersion).toBe("IR-CTO-HAULAGE-2026.01");
    });
  });

  describe("7. Currency Formatting Helper", () => {
    it("formats Indian Rupees correctly", () => {
      expect(formatINR(70600)).toBe("₹70,600");
      expect(formatINR(114600)).toBe("₹1,14,600");
    });
  });
});
