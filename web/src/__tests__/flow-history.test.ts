/**
 * Tests for the Flow History API endpoint — Round 15.
 *
 * Route: GET /api/rivers/:id/flow-history
 * Source: web/src/app/api/rivers/[id]/flow-history/route.ts
 *
 * Coverage:
 * - All 4 range params (24h, 7d, 30d, 90d)
 * - Default range is 7d
 * - Invalid range → 400
 * - River not found → 404
 * - Response shape (points array, river, range)
 * - Points ordered by scrapedAt ascending
 * - Empty conditions return empty points array
 * - Point fields: timestamp, flowRate, gaugeHeight, waterTemp, source
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  river: {
    findUnique: vi.fn(),
  },
  riverCondition: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

import { GET } from "@/app/api/rivers/[id]/flow-history/route";

// ─── Helpers ─────────────────────────────────────────────

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function mockRequest(url: string): Request {
  return new Request(url);
}

function makeSampleConditions(count: number, riverId: string = "river-1") {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    scrapedAt: new Date(now - (count - i) * 3600 * 1000), // ordered asc
    flowRate: 100 + i * 10,
    gaugeHeight: 2.0 + i * 0.1,
    waterTemp: 50 + i,
    source: "usgs",
    riverId,
  }));
}

// ─── Valid Range Parameters ─────────────────────────────

describe("GET /api/rivers/:id/flow-history — range params", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.river.findUnique.mockResolvedValue({ id: "river-1", name: "Test River" });
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);
  });

  it("defaults to 7d range when no range param", async () => {
    const req = mockRequest("http://localhost/api/rivers/river-1/flow-history");
    const res = await GET(req, makeContext("river-1"));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.range).toBe("7d");
  });

  it.each(["24h", "7d", "30d", "90d"])("accepts range=%s", async (range) => {
    const req = mockRequest(
      `http://localhost/api/rivers/river-1/flow-history?range=${range}`
    );
    const res = await GET(req, makeContext("river-1"));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.range).toBe(range);
  });

  it("returns 400 for invalid range param", async () => {
    const req = mockRequest(
      "http://localhost/api/rivers/river-1/flow-history?range=1y"
    );
    const res = await GET(req, makeContext("river-1"));

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid range");
  });

  it("returns 400 for empty range param", async () => {
    const req = mockRequest(
      "http://localhost/api/rivers/river-1/flow-history?range="
    );
    const res = await GET(req, makeContext("river-1"));

    // Empty string is not in VALID_RANGES
    expect(res.status).toBe(400);
  });
});

// ─── River Not Found ────────────────────────────────────

describe("GET /api/rivers/:id/flow-history — river not found", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when river does not exist", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(null);

    const req = mockRequest(
      "http://localhost/api/rivers/nonexistent/flow-history"
    );
    const res = await GET(req, makeContext("nonexistent"));

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain("River not found");
  });
});

// ─── Response Shape ─────────────────────────────────────

describe("GET /api/rivers/:id/flow-history — response shape", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns correct top-level shape: { points, river, range }", async () => {
    mockPrisma.river.findUnique.mockResolvedValue({
      id: "r1",
      name: "Snake River",
    });
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);

    const req = mockRequest("http://localhost/api/rivers/r1/flow-history");
    const res = await GET(req, makeContext("r1"));

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data).toHaveProperty("points");
    expect(data).toHaveProperty("river");
    expect(data).toHaveProperty("range");
    expect(Array.isArray(data.points)).toBe(true);
    expect(data.river).toEqual({ id: "r1", name: "Snake River" });
  });

  it("each point has timestamp, flowRate, gaugeHeight, waterTemp, source", async () => {
    const now = new Date();
    mockPrisma.river.findUnique.mockResolvedValue({ id: "r1", name: "River" });
    mockPrisma.riverCondition.findMany.mockResolvedValue([
      {
        scrapedAt: now,
        flowRate: 500,
        gaugeHeight: 3.2,
        waterTemp: 55,
        source: "usgs",
      },
    ]);

    const req = mockRequest("http://localhost/api/rivers/r1/flow-history");
    const res = await GET(req, makeContext("r1"));
    const data = await res.json();

    expect(data.points).toHaveLength(1);
    const point = data.points[0];
    expect(point).toEqual({
      timestamp: now.toISOString(),
      flowRate: 500,
      gaugeHeight: 3.2,
      waterTemp: 55,
      source: "usgs",
    });
  });

  it("returns empty points array when no conditions found", async () => {
    mockPrisma.river.findUnique.mockResolvedValue({ id: "r1", name: "River" });
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);

    const req = mockRequest("http://localhost/api/rivers/r1/flow-history");
    const res = await GET(req, makeContext("r1"));
    const data = await res.json();

    expect(data.points).toEqual([]);
  });
});

// ─── Ordering ───────────────────────────────────────────

describe("GET /api/rivers/:id/flow-history — ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries with orderBy scrapedAt ascending", async () => {
    mockPrisma.river.findUnique.mockResolvedValue({ id: "r1", name: "River" });
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);

    const req = mockRequest("http://localhost/api/rivers/r1/flow-history");
    await GET(req, makeContext("r1"));

    expect(mockPrisma.riverCondition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { scrapedAt: "asc" },
      })
    );
  });

  it("points come back in chronological order", async () => {
    const conditions = makeSampleConditions(3, "r1");
    mockPrisma.river.findUnique.mockResolvedValue({ id: "r1", name: "River" });
    mockPrisma.riverCondition.findMany.mockResolvedValue(conditions);

    const req = mockRequest("http://localhost/api/rivers/r1/flow-history");
    const res = await GET(req, makeContext("r1"));
    const data = await res.json();

    const timestamps = data.points.map((p: { timestamp: string }) =>
      new Date(p.timestamp).getTime()
    );
    for (let i = 1; i < timestamps.length; i++) {
      expect(timestamps[i]).toBeGreaterThan(timestamps[i - 1]);
    }
  });
});

// ─── Prisma Query Parameters ────────────────────────────

describe("GET /api/rivers/:id/flow-history — Prisma queries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("queries river by ID", async () => {
    mockPrisma.river.findUnique.mockResolvedValue({ id: "r1", name: "River" });
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);

    const req = mockRequest("http://localhost/api/rivers/r1/flow-history");
    await GET(req, makeContext("r1"));

    expect(mockPrisma.river.findUnique).toHaveBeenCalledWith({
      where: { id: "r1" },
      select: { id: true, name: true },
    });
  });

  it("queries conditions with correct time window for 24h", async () => {
    mockPrisma.river.findUnique.mockResolvedValue({ id: "r1", name: "River" });
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);

    const req = mockRequest(
      "http://localhost/api/rivers/r1/flow-history?range=24h"
    );
    await GET(req, makeContext("r1"));

    const call = mockPrisma.riverCondition.findMany.mock.calls[0][0];
    expect(call.where.riverId).toBe("r1");

    const since = call.where.scrapedAt.gte;
    const expected = new Date("2025-05-31T12:00:00Z");
    expect(Math.abs(since.getTime() - expected.getTime())).toBeLessThan(1000);
  });

  it("queries conditions with correct time window for 30d", async () => {
    mockPrisma.river.findUnique.mockResolvedValue({ id: "r1", name: "River" });
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);

    const req = mockRequest(
      "http://localhost/api/rivers/r1/flow-history?range=30d"
    );
    await GET(req, makeContext("r1"));

    const call = mockPrisma.riverCondition.findMany.mock.calls[0][0];
    const since = call.where.scrapedAt.gte;
    const expected = new Date("2025-05-02T12:00:00Z");
    expect(Math.abs(since.getTime() - expected.getTime())).toBeLessThan(1000);
  });

  it("selects only flowRate, gaugeHeight, waterTemp, source, scrapedAt", async () => {
    mockPrisma.river.findUnique.mockResolvedValue({ id: "r1", name: "River" });
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);

    const req = mockRequest("http://localhost/api/rivers/r1/flow-history");
    await GET(req, makeContext("r1"));

    const call = mockPrisma.riverCondition.findMany.mock.calls[0][0];
    expect(call.select).toEqual({
      scrapedAt: true,
      flowRate: true,
      gaugeHeight: true,
      waterTemp: true,
      source: true,
    });
  });
});

// ─── Multiple Points ────────────────────────────────────

describe("GET /api/rivers/:id/flow-history — multiple data points", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all data points from the query", async () => {
    const conditions = makeSampleConditions(5, "r1");
    mockPrisma.river.findUnique.mockResolvedValue({ id: "r1", name: "River" });
    mockPrisma.riverCondition.findMany.mockResolvedValue(conditions);

    const req = mockRequest("http://localhost/api/rivers/r1/flow-history");
    const res = await GET(req, makeContext("r1"));
    const data = await res.json();

    expect(data.points).toHaveLength(5);
    expect(data.points[0].flowRate).toBe(100);
    expect(data.points[4].flowRate).toBe(140);
  });

  it("handles null flowRate/gaugeHeight/waterTemp values", async () => {
    mockPrisma.river.findUnique.mockResolvedValue({ id: "r1", name: "River" });
    mockPrisma.riverCondition.findMany.mockResolvedValue([
      {
        scrapedAt: new Date(),
        flowRate: null,
        gaugeHeight: null,
        waterTemp: null,
        source: "usgs",
      },
    ]);

    const req = mockRequest("http://localhost/api/rivers/r1/flow-history");
    const res = await GET(req, makeContext("r1"));
    const data = await res.json();

    expect(data.points[0].flowRate).toBeNull();
    expect(data.points[0].gaugeHeight).toBeNull();
    expect(data.points[0].waterTemp).toBeNull();
  });
});

// ─── Error Handling ─────────────────────────────────────

describe("GET /api/rivers/:id/flow-history — error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles Prisma errors with handleApiError", async () => {
    mockPrisma.river.findUnique.mockRejectedValue(new Error("DB connection error"));

    const req = mockRequest("http://localhost/api/rivers/r1/flow-history");
    const res = await GET(req, makeContext("r1"));

    // handleApiError returns 500 for unknown errors
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("handles condition query failure gracefully", async () => {
    mockPrisma.river.findUnique.mockResolvedValue({ id: "r1", name: "River" });
    mockPrisma.riverCondition.findMany.mockRejectedValue(new Error("Timeout"));

    const req = mockRequest("http://localhost/api/rivers/r1/flow-history");
    const res = await GET(req, makeContext("r1"));

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
