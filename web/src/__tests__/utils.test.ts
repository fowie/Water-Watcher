/**
 * Tests for utility functions in lib/utils.ts.
 *
 * Covers formatting, color mapping, and edge cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatFlowRate,
  formatPrice,
  qualityColor,
  severityColor,
  timeAgo,
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

// ─── timeAgo ──────────────────────────────────────────────

describe("timeAgo", () => {
  const NOW = new Date("2026-02-24T12:00:00Z").getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── "just now" for dates within the last minute ──

  it('returns "just now" for 0 seconds ago', () => {
    expect(timeAgo(new Date(NOW).toISOString())).toBe("just now");
  });

  it('returns "just now" for 30 seconds ago', () => {
    const d = new Date(NOW - 30 * 1000).toISOString();
    expect(timeAgo(d)).toBe("just now");
  });

  it('returns "just now" for 59 seconds ago', () => {
    const d = new Date(NOW - 59 * 1000).toISOString();
    expect(timeAgo(d)).toBe("just now");
  });

  // ── "X minutes ago" for 1-59 minutes ──

  it('returns "1 minute ago" (singular)', () => {
    const d = new Date(NOW - 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("1 minute ago");
  });

  it('returns "30 minutes ago"', () => {
    const d = new Date(NOW - 30 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("30 minutes ago");
  });

  it('returns "59 minutes ago"', () => {
    const d = new Date(NOW - 59 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("59 minutes ago");
  });

  // ── "X hours ago" for 1-23 hours ──

  it('returns "1 hour ago" (singular)', () => {
    const d = new Date(NOW - 60 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("1 hour ago");
  });

  it('returns "12 hours ago"', () => {
    const d = new Date(NOW - 12 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("12 hours ago");
  });

  it('returns "23 hours ago"', () => {
    const d = new Date(NOW - 23 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("23 hours ago");
  });

  // ── "X days ago" for 1-29 days ──
  // Note: code does not have a "weeks" bucket — days go directly to months at 30.

  it('returns "1 day ago" (singular)', () => {
    const d = new Date(NOW - 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("1 day ago");
  });

  it('returns "6 days ago"', () => {
    const d = new Date(NOW - 6 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("6 days ago");
  });

  it('returns "1 week ago" for 7 days', () => {
    const d = new Date(NOW - 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("1 week ago");
  });

  it('returns "3 weeks ago" for 27 days', () => {
    const d = new Date(NOW - 27 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("3 weeks ago");
  });

  it('returns "4 weeks ago" for 29 days (boundary before months)', () => {
    const d = new Date(NOW - 29 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("4 weeks ago");
  });

  // ── "X months ago" ──

  it('returns "1 month ago" for 30 days', () => {
    const d = new Date(NOW - 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("1 month ago");
  });

  it('returns "3 months ago" for ~90 days', () => {
    const d = new Date(NOW - 90 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("3 months ago");
  });

  it('returns "11 months ago" for ~330 days', () => {
    const d = new Date(NOW - 330 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("11 months ago");
  });

  // ── years ──

  it('returns "1 year ago" for 365+ days', () => {
    const d = new Date(NOW - 365 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("1 year ago");
  });

  it('returns "2 years ago"', () => {
    const d = new Date(NOW - 730 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(d)).toBe("2 years ago");
  });

  // ── Invalid / empty date strings ──

  it('returns "unknown" for empty string', () => {
    expect(timeAgo("")).toBe("unknown");
  });

  it('returns "unknown" for garbage input', () => {
    expect(timeAgo("not-a-date")).toBe("unknown");
  });

  // ── Future dates ──

  it('returns "just now" for future date', () => {
    const future = new Date(NOW + 60 * 60 * 1000).toISOString();
    expect(timeAgo(future)).toBe("just now");
  });

  it('returns "just now" for date far in the future', () => {
    const future = new Date(NOW + 365 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(future)).toBe("just now");
  });
});
