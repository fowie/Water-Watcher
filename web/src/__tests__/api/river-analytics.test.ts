/**
 * Tests for the River Analytics API route handler.
 *
 * Route:
 *   GET /api/rivers/[id]/analytics — aggregate analytics for a river
 *
 * Coverage:
 * - Returns 404 for unknown river
 * - Returns flow trends with daily averages
 * - Returns quality distribution counts
 * - Returns best time to visit (month with most excellent/good conditions)
 * - Returns review stats (count and average rating)
 * - Returns visit count from trip stops
 * - Handles river with no data (empty arrays/nulls)
 * - Handles database errors
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  river: {
    findUnique: vi.fn(),
  },
  riverCondition: {
    findMany: vi.fn(),
    groupBy: vi.fn(),
  },
  riverReview: {
    aggregate: vi.fn(),
  },
  tripStop: {
    count: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

import { GET } from "@/app/api/rivers/[id]/analytics/route";

const RIVER_ID = "river-1";

function mockRequest(url: string): Request {
  return new Request(url);
}

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/rivers/[id]/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.river.findUnique.mockResolvedValue({ id: RIVER_ID, name: "Test River" });
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);
    mockPrisma.riverCondition.groupBy.mockResolvedValue([]);
    mockPrisma.riverReview.aggregate.mockResolvedValue({
      _count: 0,
      _avg: { rating: null },
    });
    mockPrisma.tripStop.count.mockResolvedValue(0);
  });

  it("returns 404 for unknown river", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(null);
    const req = mockRequest("http://localhost/api/rivers/unknown/analytics");
    const res = await GET(req, makeContext("unknown"));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain("not found");
  });

  it("returns analytics structure for a river with no data", async () => {
    const req = mockRequest(`http://localhost/api/rivers/${RIVER_ID}/analytics`);
    const res = await GET(req, makeContext(RIVER_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.riverId).toBe(RIVER_ID);
    expect(data.riverName).toBe("Test River");
    expect(data.flowTrends).toEqual([]);
    expect(data.qualityDistribution).toEqual({});
    expect(data.bestTimeToVisit).toBeNull();
    expect(data.reviews.totalCount).toBe(0);
    expect(data.reviews.averageRating).toBeNull();
    expect(data.visitCount).toBe(0);
  });

  it("returns flow trends with daily averages", async () => {
    // Two conditions on same day, one on next day
    mockPrisma.riverCondition.findMany.mockImplementation(
      (args: { where?: { quality?: unknown } }) => {
        if (args?.where && "quality" in args.where) {
          // Best month query (excellent/good)
          return Promise.resolve([]);
        }
        // Flow trends query (last 30 days)
        return Promise.resolve([
          {
            flowRate: 100,
            gaugeHeight: 3.5,
            waterTemp: 55,
            quality: "good",
            scrapedAt: new Date("2026-02-20T10:00:00Z"),
          },
          {
            flowRate: 200,
            gaugeHeight: 4.0,
            waterTemp: 58,
            quality: "good",
            scrapedAt: new Date("2026-02-20T14:00:00Z"),
          },
          {
            flowRate: 300,
            gaugeHeight: 5.0,
            waterTemp: 60,
            quality: "excellent",
            scrapedAt: new Date("2026-02-21T10:00:00Z"),
          },
        ]);
      }
    );

    const req = mockRequest(`http://localhost/api/rivers/${RIVER_ID}/analytics`);
    const res = await GET(req, makeContext(RIVER_ID));
    const data = await res.json();

    expect(data.flowTrends).toHaveLength(2);

    // Day 1: average of 100 and 200 = 150
    expect(data.flowTrends[0].date).toBe("2026-02-20");
    expect(data.flowTrends[0].avgFlowRate).toBe(150);
    expect(data.flowTrends[0].avgGaugeHeight).toBe(3.75);

    // Day 2: single value
    expect(data.flowTrends[1].date).toBe("2026-02-21");
    expect(data.flowTrends[1].avgFlowRate).toBe(300);
  });

  it("returns quality distribution counts", async () => {
    mockPrisma.riverCondition.groupBy.mockResolvedValue([
      { quality: "excellent", _count: 10 },
      { quality: "good", _count: 25 },
      { quality: "fair", _count: 8 },
      { quality: "poor", _count: 3 },
    ]);

    const req = mockRequest(`http://localhost/api/rivers/${RIVER_ID}/analytics`);
    const res = await GET(req, makeContext(RIVER_ID));
    const data = await res.json();

    expect(data.qualityDistribution).toEqual({
      excellent: 10,
      good: 25,
      fair: 8,
      poor: 3,
    });
  });

  it("returns best time to visit", async () => {
    // Best month query returns conditions with dates spread across months
    mockPrisma.riverCondition.findMany.mockImplementation(
      (args: { where?: { quality?: unknown } }) => {
        if (args?.where && "quality" in args.where) {
          // Excellent/good conditions
          return Promise.resolve([
            { scrapedAt: new Date("2026-06-15T10:00:00Z") },
            { scrapedAt: new Date("2026-06-20T10:00:00Z") },
            { scrapedAt: new Date("2026-06-25T10:00:00Z") },
            { scrapedAt: new Date("2026-07-10T10:00:00Z") },
            { scrapedAt: new Date("2026-07-20T10:00:00Z") },
            { scrapedAt: new Date("2026-08-05T10:00:00Z") },
          ]);
        }
        // Flow trends query
        return Promise.resolve([]);
      }
    );

    const req = mockRequest(`http://localhost/api/rivers/${RIVER_ID}/analytics`);
    const res = await GET(req, makeContext(RIVER_ID));
    const data = await res.json();

    expect(data.bestTimeToVisit).toBeDefined();
    expect(data.bestTimeToVisit.month).toBe("June");
    expect(data.bestTimeToVisit.goodConditionCount).toBe(3);
  });

  it("returns review stats with count and average", async () => {
    mockPrisma.riverReview.aggregate.mockResolvedValue({
      _count: 15,
      _avg: { rating: 4.2 },
    });

    const req = mockRequest(`http://localhost/api/rivers/${RIVER_ID}/analytics`);
    const res = await GET(req, makeContext(RIVER_ID));
    const data = await res.json();

    expect(data.reviews.totalCount).toBe(15);
    expect(data.reviews.averageRating).toBe(4.2);
  });

  it("returns visit count from trip stops", async () => {
    mockPrisma.tripStop.count.mockResolvedValue(42);

    const req = mockRequest(`http://localhost/api/rivers/${RIVER_ID}/analytics`);
    const res = await GET(req, makeContext(RIVER_ID));
    const data = await res.json();

    expect(data.visitCount).toBe(42);
  });

  it("handles conditions with null flow rate", async () => {
    mockPrisma.riverCondition.findMany.mockImplementation(
      (args: { where?: { quality?: unknown } }) => {
        if (args?.where && "quality" in args.where) return Promise.resolve([]);
        return Promise.resolve([
          {
            flowRate: null,
            gaugeHeight: null,
            waterTemp: 55,
            quality: "good",
            scrapedAt: new Date("2026-02-20T10:00:00Z"),
          },
        ]);
      }
    );

    const req = mockRequest(`http://localhost/api/rivers/${RIVER_ID}/analytics`);
    const res = await GET(req, makeContext(RIVER_ID));
    const data = await res.json();

    expect(data.flowTrends).toHaveLength(1);
    expect(data.flowTrends[0].avgFlowRate).toBeNull();
    expect(data.flowTrends[0].avgGaugeHeight).toBeNull();
    expect(data.flowTrends[0].avgWaterTemp).toBe(55);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.river.findUnique.mockRejectedValue(new Error("DB error"));
    const req = mockRequest(`http://localhost/api/rivers/${RIVER_ID}/analytics`);
    const res = await GET(req, makeContext(RIVER_ID));
    expect(res.status).toBe(500);
  });

  // ─── Additional edge cases ─────────────────────────

  it("flow trends are sorted by date ascending", async () => {
    mockPrisma.riverCondition.findMany.mockImplementation(
      (args: { where?: { quality?: unknown } }) => {
        if (args?.where && "quality" in args.where) return Promise.resolve([]);
        return Promise.resolve([
          { flowRate: 200, gaugeHeight: null, waterTemp: null, quality: "good", scrapedAt: new Date("2026-02-22T10:00:00Z") },
          { flowRate: 100, gaugeHeight: null, waterTemp: null, quality: "good", scrapedAt: new Date("2026-02-20T10:00:00Z") },
          { flowRate: 150, gaugeHeight: null, waterTemp: null, quality: "good", scrapedAt: new Date("2026-02-21T10:00:00Z") },
        ]);
      }
    );

    const req = mockRequest(`http://localhost/api/rivers/${RIVER_ID}/analytics`);
    const res = await GET(req, makeContext(RIVER_ID));
    const data = await res.json();

    expect(data.flowTrends[0].date).toBe("2026-02-20");
    expect(data.flowTrends[1].date).toBe("2026-02-21");
    expect(data.flowTrends[2].date).toBe("2026-02-22");
  });

  it("daily averages round to 2 decimal places", async () => {
    mockPrisma.riverCondition.findMany.mockImplementation(
      (args: { where?: { quality?: unknown } }) => {
        if (args?.where && "quality" in args.where) return Promise.resolve([]);
        return Promise.resolve([
          { flowRate: 100, gaugeHeight: null, waterTemp: null, quality: "good", scrapedAt: new Date("2026-02-20T10:00:00Z") },
          { flowRate: 200, gaugeHeight: null, waterTemp: null, quality: "good", scrapedAt: new Date("2026-02-20T14:00:00Z") },
          { flowRate: 300, gaugeHeight: null, waterTemp: null, quality: "good", scrapedAt: new Date("2026-02-20T18:00:00Z") },
        ]);
      }
    );

    const req = mockRequest(`http://localhost/api/rivers/${RIVER_ID}/analytics`);
    const res = await GET(req, makeContext(RIVER_ID));
    const data = await res.json();

    // (100 + 200 + 300) / 3 = 200
    expect(data.flowTrends[0].avgFlowRate).toBe(200);
  });

  it("only counts excellent and good for best month (fair/poor excluded)", async () => {
    mockPrisma.riverCondition.findMany.mockImplementation(
      (args: { where?: { quality?: unknown } }) => {
        if (args?.where && "quality" in args.where) {
          // The route queries with quality: { in: ["excellent", "good"] }
          // so fair/poor are excluded at the query level
          return Promise.resolve([
            { scrapedAt: new Date("2026-06-15T10:00:00Z") },
            { scrapedAt: new Date("2026-06-20T10:00:00Z") },
          ]);
        }
        return Promise.resolve([]);
      }
    );

    const req = mockRequest(`http://localhost/api/rivers/${RIVER_ID}/analytics`);
    const res = await GET(req, makeContext(RIVER_ID));
    const data = await res.json();

    expect(data.bestTimeToVisit.month).toBe("June");
    expect(data.bestTimeToVisit.goodConditionCount).toBe(2);
  });

  it("bestTimeToVisit is null when no excellent/good conditions exist", async () => {
    const req = mockRequest(`http://localhost/api/rivers/${RIVER_ID}/analytics`);
    const res = await GET(req, makeContext(RIVER_ID));
    const data = await res.json();

    expect(data.bestTimeToVisit).toBeNull();
  });

  it("review averageRating is rounded to 1 decimal", async () => {
    mockPrisma.riverReview.aggregate.mockResolvedValue({
      _count: 10,
      _avg: { rating: 3.666667 },
    });

    const req = mockRequest(`http://localhost/api/rivers/${RIVER_ID}/analytics`);
    const res = await GET(req, makeContext(RIVER_ID));
    const data = await res.json();

    expect(data.reviews.averageRating).toBe(3.7);
  });

  it("handles river with lots of data (many days)", async () => {
    // Generate 30 days of conditions (2 per day = 60 records)
    const conditions = [];
    for (let day = 0; day < 30; day++) {
      const date = new Date("2026-01-25T10:00:00Z");
      date.setDate(date.getDate() + day);
      conditions.push(
        { flowRate: 100 + day * 10, gaugeHeight: 3.0 + day * 0.1, waterTemp: 50 + day, quality: "good", scrapedAt: new Date(date) },
      );
      const date2 = new Date(date);
      date2.setHours(14);
      conditions.push(
        { flowRate: 110 + day * 10, gaugeHeight: 3.1 + day * 0.1, waterTemp: 51 + day, quality: "excellent", scrapedAt: date2 },
      );
    }

    mockPrisma.riverCondition.findMany.mockImplementation(
      (args: { where?: { quality?: unknown } }) => {
        if (args?.where && "quality" in args.where) {
          return Promise.resolve(conditions.map(c => ({ scrapedAt: c.scrapedAt })));
        }
        return Promise.resolve(conditions);
      }
    );

    mockPrisma.riverCondition.groupBy.mockResolvedValue([
      { quality: "excellent", _count: 30 },
      { quality: "good", _count: 30 },
    ]);

    mockPrisma.riverReview.aggregate.mockResolvedValue({
      _count: 50,
      _avg: { rating: 4.5 },
    });

    mockPrisma.tripStop.count.mockResolvedValue(100);

    const req = mockRequest(`http://localhost/api/rivers/${RIVER_ID}/analytics`);
    const res = await GET(req, makeContext(RIVER_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.flowTrends).toHaveLength(30);
    expect(data.qualityDistribution.excellent).toBe(30);
    expect(data.qualityDistribution.good).toBe(30);
    expect(data.reviews.totalCount).toBe(50);
    expect(data.visitCount).toBe(100);
    expect(data.bestTimeToVisit).toBeDefined();
  });

  it("includes riverId and riverName in response", async () => {
    const req = mockRequest(`http://localhost/api/rivers/${RIVER_ID}/analytics`);
    const res = await GET(req, makeContext(RIVER_ID));
    const data = await res.json();

    expect(data.riverId).toBe(RIVER_ID);
    expect(data.riverName).toBe("Test River");
  });

  it("water temp averaging works correctly", async () => {
    mockPrisma.riverCondition.findMany.mockImplementation(
      (args: { where?: { quality?: unknown } }) => {
        if (args?.where && "quality" in args.where) return Promise.resolve([]);
        return Promise.resolve([
          { flowRate: null, gaugeHeight: null, waterTemp: 50, quality: "good", scrapedAt: new Date("2026-02-20T08:00:00Z") },
          { flowRate: null, gaugeHeight: null, waterTemp: 60, quality: "good", scrapedAt: new Date("2026-02-20T16:00:00Z") },
        ]);
      }
    );

    const req = mockRequest(`http://localhost/api/rivers/${RIVER_ID}/analytics`);
    const res = await GET(req, makeContext(RIVER_ID));
    const data = await res.json();

    expect(data.flowTrends[0].avgWaterTemp).toBe(55);
    expect(data.flowTrends[0].avgFlowRate).toBeNull();
  });
});
