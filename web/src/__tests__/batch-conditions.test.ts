/**
 * Tests for the Batch Conditions API endpoint — Round 15.
 *
 * Route: GET /api/rivers/conditions
 * Source: web/src/app/api/rivers/conditions/route.ts
 *
 * Coverage:
 * - Missing ids → 400
 * - Empty ids → 400
 * - Exceeding 50 IDs → 400
 * - Returns latest condition per river
 * - Returns null for rivers with no conditions
 * - Handles non-existent river IDs
 * - Response shape: { conditions: { [riverId]: {...} | null } }
 * - Condition fields include river relation data
 * - Whitespace-only IDs are filtered out
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  riverCondition: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

import { GET } from "@/app/api/rivers/conditions/route";

// ─── Helpers ─────────────────────────────────────────────

function mockRequest(url: string): Request {
  return new Request(url);
}

function makeCondition(
  id: string,
  riverId: string,
  riverName: string,
  scrapedAt: Date,
  overrides: Record<string, unknown> = {}
) {
  return {
    id,
    riverId,
    flowRate: 200,
    gaugeHeight: 3.5,
    waterTemp: 55,
    quality: "good",
    runnability: "runnable",
    source: "usgs",
    scrapedAt,
    river: {
      id: riverId,
      name: riverName,
      state: "CO",
      difficulty: "III",
    },
    ...overrides,
  };
}

// ─── Validation Errors ──────────────────────────────────

describe("GET /api/rivers/conditions — validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when ids param is missing", async () => {
    const req = mockRequest("http://localhost/api/rivers/conditions");
    const res = await GET(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("ids");
  });

  it("returns 400 when ids param is empty string", async () => {
    const req = mockRequest("http://localhost/api/rivers/conditions?ids=");
    const res = await GET(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    // Empty string is falsy, so hits the "Missing" check first
    expect(data.error).toContain("ids");
  });

  it("returns 400 when ids contains only whitespace", async () => {
    const req = mockRequest("http://localhost/api/rivers/conditions?ids=%20,%20");
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when more than 50 IDs are provided", async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `river-${i}`).join(",");
    const req = mockRequest(`http://localhost/api/rivers/conditions?ids=${ids}`);
    const res = await GET(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("50");
  });

  it("accepts exactly 50 IDs", async () => {
    const ids = Array.from({ length: 50 }, (_, i) => `river-${i}`).join(",");
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);

    const req = mockRequest(`http://localhost/api/rivers/conditions?ids=${ids}`);
    const res = await GET(req);

    expect(res.status).toBe(200);
  });
});

// ─── Latest Condition Per River ─────────────────────────

describe("GET /api/rivers/conditions — latest condition per river", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the most recent condition for each river", async () => {
    const now = new Date();
    const older = new Date(now.getTime() - 3600 * 1000);

    // Prisma returns ordered desc, so newer first
    mockPrisma.riverCondition.findMany.mockResolvedValue([
      makeCondition("c1", "r1", "Snake River", now),
      makeCondition("c2", "r1", "Snake River", older),
      makeCondition("c3", "r2", "Clear Creek", now),
    ]);

    const req = mockRequest(
      "http://localhost/api/rivers/conditions?ids=r1,r2"
    );
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.conditions.r1.id).toBe("c1"); // newer one
    expect(data.conditions.r2.id).toBe("c3");
  });

  it("only keeps first (most recent) condition per riverId", async () => {
    const now = new Date();
    const older = new Date(now.getTime() - 7200 * 1000);
    const oldest = new Date(now.getTime() - 14400 * 1000);

    mockPrisma.riverCondition.findMany.mockResolvedValue([
      makeCondition("c1", "r1", "River A", now),
      makeCondition("c2", "r1", "River A", older),
      makeCondition("c3", "r1", "River A", oldest),
    ]);

    const req = mockRequest("http://localhost/api/rivers/conditions?ids=r1");
    const res = await GET(req);
    const data = await res.json();

    expect(data.conditions.r1.id).toBe("c1");
    expect(data.conditions.r1.scrapedAt).toBe(now.toISOString());
  });
});

// ─── Null for Missing Rivers ────────────────────────────

describe("GET /api/rivers/conditions — rivers without conditions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for rivers with no conditions", async () => {
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);

    const req = mockRequest(
      "http://localhost/api/rivers/conditions?ids=r1,r2"
    );
    const res = await GET(req);
    const data = await res.json();

    expect(data.conditions.r1).toBeNull();
    expect(data.conditions.r2).toBeNull();
  });

  it("mixes found and not-found rivers correctly", async () => {
    const now = new Date();
    mockPrisma.riverCondition.findMany.mockResolvedValue([
      makeCondition("c1", "r1", "Snake River", now),
    ]);

    const req = mockRequest(
      "http://localhost/api/rivers/conditions?ids=r1,r2,r3"
    );
    const res = await GET(req);
    const data = await res.json();

    expect(data.conditions.r1).not.toBeNull();
    expect(data.conditions.r1.id).toBe("c1");
    expect(data.conditions.r2).toBeNull();
    expect(data.conditions.r3).toBeNull();
  });
});

// ─── Response Shape ─────────────────────────────────────

describe("GET /api/rivers/conditions — response shape", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("response has { conditions } top-level key", async () => {
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);

    const req = mockRequest("http://localhost/api/rivers/conditions?ids=r1");
    const res = await GET(req);
    const data = await res.json();

    expect(data).toHaveProperty("conditions");
    expect(typeof data.conditions).toBe("object");
  });

  it("condition entries include river relation data", async () => {
    const now = new Date();
    mockPrisma.riverCondition.findMany.mockResolvedValue([
      makeCondition("c1", "r1", "Snake River", now, {
        river: {
          id: "r1",
          name: "Snake River",
          state: "WY",
          difficulty: "IV",
        },
      }),
    ]);

    const req = mockRequest("http://localhost/api/rivers/conditions?ids=r1");
    const res = await GET(req);
    const data = await res.json();

    const condition = data.conditions.r1;
    expect(condition.riverName).toBe("Snake River");
    expect(condition.state).toBe("WY");
    expect(condition.difficulty).toBe("IV");
  });

  it("condition entry fields match expected schema", async () => {
    const now = new Date();
    mockPrisma.riverCondition.findMany.mockResolvedValue([
      makeCondition("c1", "r1", "Test River", now),
    ]);

    const req = mockRequest("http://localhost/api/rivers/conditions?ids=r1");
    const res = await GET(req);
    const data = await res.json();

    const condition = data.conditions.r1;
    expect(condition).toEqual(
      expect.objectContaining({
        id: "c1",
        riverId: "r1",
        riverName: "Test River",
        flowRate: expect.any(Number),
        gaugeHeight: expect.any(Number),
        waterTemp: expect.any(Number),
        quality: expect.any(String),
        runnability: expect.any(String),
        source: expect.any(String),
        scrapedAt: now.toISOString(),
      })
    );
  });

  it("scrapedAt is returned as ISO string", async () => {
    const now = new Date("2025-06-01T15:00:00.000Z");
    mockPrisma.riverCondition.findMany.mockResolvedValue([
      makeCondition("c1", "r1", "River", now),
    ]);

    const req = mockRequest("http://localhost/api/rivers/conditions?ids=r1");
    const res = await GET(req);
    const data = await res.json();

    expect(data.conditions.r1.scrapedAt).toBe("2025-06-01T15:00:00.000Z");
  });
});

// ─── Prisma Query ───────────────────────────────────────

describe("GET /api/rivers/conditions — Prisma query", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries with riverId in list of IDs", async () => {
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);

    const req = mockRequest(
      "http://localhost/api/rivers/conditions?ids=r1,r2,r3"
    );
    await GET(req);

    expect(mockPrisma.riverCondition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { riverId: { in: ["r1", "r2", "r3"] } },
      })
    );
  });

  it("orders results by scrapedAt descending", async () => {
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);

    const req = mockRequest("http://localhost/api/rivers/conditions?ids=r1");
    await GET(req);

    expect(mockPrisma.riverCondition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { scrapedAt: "desc" },
      })
    );
  });

  it("includes river relation with id, name, state, difficulty", async () => {
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);

    const req = mockRequest("http://localhost/api/rivers/conditions?ids=r1");
    await GET(req);

    expect(mockPrisma.riverCondition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          river: {
            select: { id: true, name: true, state: true, difficulty: true },
          },
        },
      })
    );
  });

  it("trims whitespace from IDs", async () => {
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);

    const req = mockRequest(
      "http://localhost/api/rivers/conditions?ids=%20r1%20,%20r2%20"
    );
    await GET(req);

    expect(mockPrisma.riverCondition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { riverId: { in: ["r1", "r2"] } },
      })
    );
  });
});

// ─── Single River ───────────────────────────────────────

describe("GET /api/rivers/conditions — single river", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("works with a single river ID", async () => {
    const now = new Date();
    mockPrisma.riverCondition.findMany.mockResolvedValue([
      makeCondition("c1", "r1", "Solo River", now),
    ]);

    const req = mockRequest("http://localhost/api/rivers/conditions?ids=r1");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(Object.keys(data.conditions)).toHaveLength(1);
    expect(data.conditions.r1.id).toBe("c1");
  });
});

// ─── Error Handling ─────────────────────────────────────

describe("GET /api/rivers/conditions — error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles Prisma errors gracefully", async () => {
    mockPrisma.riverCondition.findMany.mockRejectedValue(
      new Error("Connection refused")
    );

    const req = mockRequest("http://localhost/api/rivers/conditions?ids=r1");
    const res = await GET(req);

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
