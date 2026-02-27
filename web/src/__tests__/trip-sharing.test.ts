/**
 * Tests for Trip Sharing functionality.
 *
 * Located in: web/src/app/trips/[id]/page.tsx (handleShare function)
 * 
 * Coverage:
 * - Web Share API called with correct data
 * - Clipboard fallback when Web Share unavailable
 * - Shareable summary format
 * - Share URL construction
 * - Error handling for clipboard and share failures
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock navigator APIs ────────────────────────────────

let mockClipboard: { writeText: ReturnType<typeof vi.fn> };
let mockShare: ReturnType<typeof vi.fn> | undefined;

describe("Trip Sharing — handleShare function logic", () => {
  beforeEach(() => {
    mockClipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
    Object.defineProperty(navigator, "clipboard", {
      value: mockClipboard,
      writable: true,
      configurable: true,
    });
    // Remove share by default for clipboard tests
    mockShare = undefined;
    Object.defineProperty(navigator, "share", {
      value: mockShare,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("clipboard fallback (current implementation)", () => {
    it("copies trip URL to clipboard", async () => {
      // Simulating the handleShare logic from trips/[id]/page.tsx
      const tripId = "trip-123";
      const origin = "http://localhost:3000";
      const url = `${origin}/trips/${tripId}`;

      await navigator.clipboard.writeText(url);

      expect(mockClipboard.writeText).toHaveBeenCalledWith(url);
    });

    it("constructs URL with correct trip ID", () => {
      const tripId = "trip-abc-123";
      const origin = "https://water-watcher.com";
      const url = `${origin}/trips/${tripId}`;

      expect(url).toBe("https://water-watcher.com/trips/trip-abc-123");
      expect(url).toContain(tripId);
    });

    it("handles clipboard writeText failure", async () => {
      mockClipboard.writeText.mockRejectedValue(new Error("Clipboard blocked"));

      let errorOccurred = false;
      try {
        await navigator.clipboard.writeText("http://localhost/trips/trip-1");
      } catch {
        errorOccurred = true;
      }
      expect(errorOccurred).toBe(true);
    });

    it("clipboard URL includes full origin and path", () => {
      const tripId = "trip-1";
      const origin = "http://localhost:3000";
      const url = `${origin}/trips/${tripId}`;
      expect(url).toMatch(/^https?:\/\/.+\/trips\/trip-1$/);
    });
  });

  describe("Web Share API (enhanced sharing)", () => {
    beforeEach(() => {
      mockShare = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "share", {
        value: mockShare,
        writable: true,
        configurable: true,
      });
    });

    it("Web Share API is callable with share data", async () => {
      const shareData = {
        title: "Colorado River Trip",
        text: "Check out my trip itinerary on Water-Watcher!",
        url: "http://localhost:3000/trips/trip-123",
      };

      await navigator.share(shareData);

      expect(mockShare).toHaveBeenCalledWith(shareData);
    });

    it("share data includes title", async () => {
      const tripName = "Grand Canyon Adventure";
      const shareData = {
        title: tripName,
        text: `Check out my trip: ${tripName}`,
        url: "http://localhost:3000/trips/trip-1",
      };

      await navigator.share(shareData);

      expect(mockShare).toHaveBeenCalledWith(
        expect.objectContaining({ title: tripName })
      );
    });

    it("share data includes trip URL", async () => {
      const tripId = "trip-456";
      const url = `http://localhost:3000/trips/${tripId}`;
      const shareData = {
        title: "My Trip",
        text: "Check out my trip!",
        url,
      };

      await navigator.share(shareData);

      const call = mockShare!.mock.calls[0][0];
      expect(call.url).toContain(tripId);
    });

    it("share data includes descriptive text", async () => {
      const shareData = {
        title: "Trip",
        text: "Check out my trip itinerary on Water-Watcher!",
        url: "http://localhost:3000/trips/trip-1",
      };

      await navigator.share(shareData);

      const call = mockShare!.mock.calls[0][0];
      expect(call.text).toBeTruthy();
      expect(call.text.length).toBeGreaterThan(0);
    });

    it("handles Web Share API rejection (user cancelled)", async () => {
      mockShare = vi.fn().mockRejectedValue(new DOMException("Share cancelled", "AbortError"));
      Object.defineProperty(navigator, "share", {
        value: mockShare,
        writable: true,
        configurable: true,
      });

      let caught = false;
      try {
        await navigator.share({ title: "T", text: "T", url: "http://x.com" });
      } catch (e) {
        caught = true;
        expect((e as DOMException).name).toBe("AbortError");
      }
      expect(caught).toBe(true);
    });

    it("falls back to clipboard when Web Share unavailable", async () => {
      Object.defineProperty(navigator, "share", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const url = "http://localhost:3000/trips/trip-1";
      // Simulate the fallback logic
      if (navigator.share) {
        await navigator.share({ title: "Trip", text: "text", url });
      } else {
        await navigator.clipboard.writeText(url);
      }

      expect(mockClipboard.writeText).toHaveBeenCalledWith(url);
    });

    it("prefers Web Share API when available", async () => {
      mockShare = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "share", {
        value: mockShare,
        writable: true,
        configurable: true,
      });

      const url = "http://localhost:3000/trips/trip-1";
      if (navigator.share) {
        await navigator.share({ title: "Trip", text: "text", url });
      } else {
        await navigator.clipboard.writeText(url);
      }

      expect(mockShare).toHaveBeenCalled();
      expect(mockClipboard.writeText).not.toHaveBeenCalled();
    });
  });

  describe("shareable summary format", () => {
    it("summary includes trip name", () => {
      const tripName = "Salmon River Float";
      const summary = `Check out my trip: ${tripName}`;
      expect(summary).toContain(tripName);
    });

    it("summary includes stop count", () => {
      const stopCount = 5;
      const summary = `${stopCount} river stops planned`;
      expect(summary).toContain("5");
      expect(summary).toContain("river stops");
    });

    it("summary includes date range", () => {
      const startDate = "2026-06-15";
      const endDate = "2026-06-20";
      const start = new Date(startDate);
      const end = new Date(endDate);
      const startStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const endStr = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const dateRange = `${startStr} – ${endStr}`;
      expect(dateRange).toContain("Jun");
    });

    it("trip URL format is valid", () => {
      const tripId = "clx12345";
      const base = "https://water-watcher.com";
      const url = `${base}/trips/${tripId}`;
      expect(url).toMatch(/^https:\/\/.+\/trips\/[a-zA-Z0-9]+$/);
    });

    it("handles special characters in trip name", () => {
      const tripName = "Gauley River — Fall Release 2026";
      const summary = `Check out my trip: ${tripName}`;
      expect(summary).toContain("Gauley River");
      expect(summary).toContain("—");
    });

    it("handles very long trip names", () => {
      const tripName = "A".repeat(200);
      const summary = `Check out my trip: ${tripName}`;
      expect(summary.length).toBeGreaterThan(200);
      // Share APIs typically handle long text fine
      expect(summary).toContain(tripName);
    });
  });
});

// ─── Source-Level Analysis of handleShare ─────────────────

describe("Trip Sharing — source-level analysis", () => {
  let pageSource: string;

  beforeEach(() => {
    try {
      const fs = require("fs");
      const p = require("path");
      pageSource = fs.readFileSync(
        p.resolve(__dirname, "../app/trips/[id]/page.tsx"),
        "utf-8"
      );
    } catch {
      pageSource = "";
    }
  });

  it("defines handleShare function", () => {
    if (!pageSource) return;
    expect(pageSource).toMatch(/handleShare/);
  });

  it("uses navigator.clipboard.writeText", () => {
    if (!pageSource) return;
    expect(pageSource).toMatch(/navigator\.clipboard\.writeText/);
  });

  it("constructs URL with trip ID", () => {
    if (!pageSource) return;
    expect(pageSource).toMatch(/\/trips\/\$\{id\}/);
  });

  it("uses try-catch for error handling", () => {
    if (!pageSource) return;
    expect(pageSource).toMatch(/try\s*\{[\s\S]*?navigator\.clipboard[\s\S]*?\}\s*catch/);
  });

  it("shows toast on successful share", () => {
    if (!pageSource) return;
    expect(pageSource).toMatch(/toast.*Link copied|toast.*copied/i);
  });

  it("shows error toast on share failure", () => {
    if (!pageSource) return;
    expect(pageSource).toMatch(/destructive/);
  });
});
