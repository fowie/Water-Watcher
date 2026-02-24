/**
 * Tests for utility functions in lib/utils.ts.
 *
 * Covers formatting, color mapping, and edge cases.
 */

import { describe, it, expect } from "vitest";
import {
  formatFlowRate,
  formatPrice,
  qualityColor,
  severityColor,
} from "@/lib/utils";

// ─── formatFlowRate ───────────────────────────────────────

describe("formatFlowRate", () => {
  it("formats normal flow rate", () => {
    expect(formatFlowRate(1200)).toBe("1,200 CFS");
  });

  it("formats zero flow", () => {
    expect(formatFlowRate(0)).toBe("0 CFS");
  });

  it("formats large flow rate with commas", () => {
    expect(formatFlowRate(45000)).toBe("45,000 CFS");
  });

  it("formats very large flow", () => {
    const result = formatFlowRate(1000000);
    expect(result).toContain("CFS");
    expect(result).toContain("1,000,000");
  });

  it("returns N/A for null", () => {
    expect(formatFlowRate(null)).toBe("N/A");
  });

  it("returns N/A for undefined", () => {
    expect(formatFlowRate(undefined)).toBe("N/A");
  });

  it("formats decimal flow rate", () => {
    // toLocaleString may vary, but should include "CFS"
    const result = formatFlowRate(1234.5);
    expect(result).toContain("CFS");
  });
});

// ─── formatPrice ──────────────────────────────────────────

describe("formatPrice", () => {
  it("formats normal price", () => {
    expect(formatPrice(1200)).toBe("$1200");
  });

  it("formats zero price (free item)", () => {
    expect(formatPrice(0)).toBe("$0");
  });

  it("truncates decimals", () => {
    expect(formatPrice(99.99)).toBe("$100");
  });

  it("returns placeholder for null", () => {
    expect(formatPrice(null)).toBe("Price not listed");
  });

  it("returns placeholder for undefined", () => {
    expect(formatPrice(undefined)).toBe("Price not listed");
  });

  it("formats small price", () => {
    expect(formatPrice(5)).toBe("$5");
  });

  it("formats large price", () => {
    expect(formatPrice(50000)).toBe("$50000");
  });
});

// ─── qualityColor ─────────────────────────────────────────

describe("qualityColor", () => {
  it("returns green for excellent", () => {
    expect(qualityColor("excellent")).toBe("text-green-600");
  });

  it("returns blue for good", () => {
    expect(qualityColor("good")).toBe("text-blue-600");
  });

  it("returns yellow for fair", () => {
    expect(qualityColor("fair")).toBe("text-yellow-600");
  });

  it("returns orange for poor", () => {
    expect(qualityColor("poor")).toBe("text-orange-600");
  });

  it("returns red for dangerous", () => {
    expect(qualityColor("dangerous")).toBe("text-red-600");
  });

  it("returns gray for null", () => {
    expect(qualityColor(null)).toBe("text-gray-500");
  });

  it("returns gray for undefined", () => {
    expect(qualityColor(undefined)).toBe("text-gray-500");
  });

  it("returns gray for unknown quality", () => {
    expect(qualityColor("unknown")).toBe("text-gray-500");
  });

  it("returns gray for empty string", () => {
    expect(qualityColor("")).toBe("text-gray-500");
  });
});

// ─── severityColor ────────────────────────────────────────

describe("severityColor", () => {
  it("returns red theme for danger", () => {
    expect(severityColor("danger")).toBe("text-red-600 bg-red-50");
  });

  it("returns yellow theme for warning", () => {
    expect(severityColor("warning")).toBe("text-yellow-700 bg-yellow-50");
  });

  it("returns blue theme for info", () => {
    expect(severityColor("info")).toBe("text-blue-600 bg-blue-50");
  });

  it("returns gray theme for unknown severity", () => {
    expect(severityColor("unknown")).toBe("text-gray-600 bg-gray-50");
  });

  it("returns gray theme for empty string", () => {
    expect(severityColor("")).toBe("text-gray-600 bg-gray-50");
  });
});
