/**
 * Additional SSE Rivers tests — Round 15.
 *
 * Route: GET /api/sse/rivers
 * Source: web/src/app/api/sse/rivers/route.ts
 *
 * These supplement the existing tests at __tests__/api/sse-rivers.test.ts.
 *
 * Focus areas:
 * - Response headers verification (text/event-stream, no-cache, keep-alive)
 * - X-Accel-Buffering header for nginx proxy
 * - ReadableStream body type
 * - Retry field is the very first output
 * - Last-Event-Id reconnection support
 * - Event format structure
 * - No auth required (public SSE endpoint)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  riverCondition: {
    findMany: vi.fn(),
  },
  hazard: {
    findMany: vi.fn(),
  },
  dealFilterMatch: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

import { GET } from "@/app/api/sse/rivers/route";

// ─── Helpers ─────────────────────────────────────────────

async function readSSEStream(
  response: Response,
  waitMs = 300
): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let result = "";

  try {
    while (true) {
      const chunk = await Promise.race([
        reader.read(),
        new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), waitMs)
        ),
      ]);
      if (chunk === null) break;
      if (chunk.done) break;
      if (chunk.value) result += decoder.decode(chunk.value, { stream: true });
    }
  } finally {
    try {
      reader.cancel();
    } catch {
      /* ignore */
    }
  }

  return result;
}

function mockRequest(
  url = "http://localhost/api/sse/rivers",
  headers: Record<string, string> = {}
): Request {
  return new Request(url, { headers });
}

// ─── Response Headers ───────────────────────────────────

describe("SSE /api/sse/rivers — response headers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);
    mockPrisma.hazard.findMany.mockResolvedValue([]);
    mockPrisma.dealFilterMatch.findMany.mockResolvedValue([]);
  });

  it("has Content-Type text/event-stream", async () => {
    const res = await GET(mockRequest());

    const contentType = res.headers.get("Content-Type");
    expect(contentType).toBe("text/event-stream");
  });

  it("has Cache-Control no-cache", async () => {
    const res = await GET(mockRequest());

    const cacheControl = res.headers.get("Cache-Control");
    expect(cacheControl).toContain("no-cache");
  });

  it("has Connection keep-alive", async () => {
    const res = await GET(mockRequest());

    const connection = res.headers.get("Connection");
    expect(connection).toBe("keep-alive");
  });

  it("has X-Accel-Buffering no for nginx proxy support", async () => {
    const res = await GET(mockRequest());

    const accelBuffering = res.headers.get("X-Accel-Buffering");
    expect(accelBuffering).toBe("no");
  });

  it("sets all SSE-critical headers together", async () => {
    const res = await GET(mockRequest());

    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toContain("no-cache");
    expect(res.headers.get("Connection")).toBe("keep-alive");
    expect(res.headers.get("X-Accel-Buffering")).toBe("no");
  });
});

// ─── ReadableStream Body ────────────────────────────────

describe("SSE /api/sse/rivers — stream body", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);
    mockPrisma.hazard.findMany.mockResolvedValue([]);
    mockPrisma.dealFilterMatch.findMany.mockResolvedValue([]);
  });

  it("returns a response with a readable stream body", async () => {
    const res = await GET(mockRequest());

    expect(res.body).toBeDefined();
    expect(res.body).toBeInstanceOf(ReadableStream);
  });

  it("response status is 200", async () => {
    const res = await GET(mockRequest());

    expect(res.status).toBe(200);
  });
});

// ─── Retry Directive ────────────────────────────────────

describe("SSE /api/sse/rivers — retry directive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);
    mockPrisma.hazard.findMany.mockResolvedValue([]);
    mockPrisma.dealFilterMatch.findMany.mockResolvedValue([]);
  });

  it("sends retry: 5000 as the first output", async () => {
    const res = await GET(mockRequest());
    const text = await readSSEStream(res);

    expect(text.startsWith("retry: 5000\n")).toBe(true);
  });

  it("retry field appears before any event data", async () => {
    const now = new Date();
    mockPrisma.riverCondition.findMany.mockResolvedValue([
      {
        id: "c1",
        riverId: "r1",
        flowRate: 500,
        gaugeHeight: 3.0,
        waterTemp: 50,
        quality: "good",
        runnability: "runnable",
        source: "usgs",
        scrapedAt: now,
        river: { id: "r1", name: "Test River", state: "CO", difficulty: "III" },
      },
    ]);
    mockPrisma.hazard.findMany.mockResolvedValue([]);
    mockPrisma.dealFilterMatch.findMany.mockResolvedValue([]);

    const res = await GET(mockRequest());
    const text = await readSSEStream(res);

    const retryIndex = text.indexOf("retry:");
    const eventIndex = text.indexOf("event:");
    expect(retryIndex).toBeLessThan(eventIndex);
  });
});

// ─── Last-Event-Id Reconnection ─────────────────────────

describe("SSE /api/sse/rivers — Last-Event-Id support", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.hazard.findMany.mockResolvedValue([]);
    mockPrisma.dealFilterMatch.findMany.mockResolvedValue([]);
  });

  it("accepts Last-Event-Id header for reconnection", async () => {
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);

    const lastSeen = new Date("2025-06-01T10:00:00Z").toISOString();
    const req = mockRequest("http://localhost/api/sse/rivers", {
      "Last-Event-Id": lastSeen,
    });
    const res = await GET(req);

    expect(res.status).toBe(200);
    // Should query conditions since the Last-Event-Id time 
    expect(mockPrisma.riverCondition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          scrapedAt: expect.objectContaining({
            gte: expect.any(Date),
          }),
        }),
      })
    );
  });

  it("supplies the lastSeen date as the gte boundary for conditions", async () => {
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);

    const lastSeen = new Date("2025-06-01T10:00:00Z");
    const req = mockRequest("http://localhost/api/sse/rivers", {
      "Last-Event-Id": lastSeen.toISOString(),
    });

    await GET(req);

    const call = mockPrisma.riverCondition.findMany.mock.calls[0][0];
    const gteValue = call.where.scrapedAt.gte;
    expect(gteValue.getTime()).toBe(lastSeen.getTime());
  });

  it("ignores invalid Last-Event-Id (defaults to 1 hour)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T12:00:00Z"));
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);

    const req = mockRequest("http://localhost/api/sse/rivers", {
      "Last-Event-Id": "not-a-date",
    });

    await GET(req);

    const call = mockPrisma.riverCondition.findMany.mock.calls[0][0];
    const gteValue = call.where.scrapedAt.gte;
    const expected = new Date("2025-06-01T11:00:00Z");
    expect(Math.abs(gteValue.getTime() - expected.getTime())).toBeLessThan(1000);

    vi.useRealTimers();
  });
});

// ─── Event Format ───────────────────────────────────────

describe("SSE /api/sse/rivers — event format", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.hazard.findMany.mockResolvedValue([]);
    mockPrisma.dealFilterMatch.findMany.mockResolvedValue([]);
  });

  it("events follow the SSE format: event/data/id fields", async () => {
    const now = new Date();
    mockPrisma.riverCondition.findMany.mockResolvedValue([
      {
        id: "c1",
        riverId: "r1",
        flowRate: 500,
        gaugeHeight: 3.0,
        waterTemp: 50,
        quality: "good",
        runnability: "runnable",
        source: "usgs",
        scrapedAt: now,
        river: { id: "r1", name: "Test River", state: "CO", difficulty: "III" },
      },
    ]);

    const res = await GET(mockRequest());
    const text = await readSSEStream(res);

    // Should contain SSE event lines
    expect(text).toContain("event: condition-update");
    expect(text).toContain("data: ");
    expect(text).toContain(`id: ${now.toISOString()}`);
  });

  it("event data is valid JSON", async () => {
    const now = new Date();
    mockPrisma.riverCondition.findMany.mockResolvedValue([
      {
        id: "c1",
        riverId: "r1",
        flowRate: 500,
        gaugeHeight: 3.0,
        waterTemp: 50,
        quality: "good",
        runnability: "runnable",
        source: "usgs",
        scrapedAt: now,
        river: { id: "r1", name: "Test River", state: "CO", difficulty: "III" },
      },
    ]);

    const res = await GET(mockRequest());
    const text = await readSSEStream(res);

    // Extract data lines
    const dataLines = text
      .split("\n")
      .filter((line) => line.startsWith("data: "));
    expect(dataLines.length).toBeGreaterThan(0);

    for (const line of dataLines) {
      const json = line.replace("data: ", "");
      expect(() => JSON.parse(json)).not.toThrow();
    }
  });

  it("each event is terminated by double newline", async () => {
    const now = new Date();
    mockPrisma.riverCondition.findMany.mockResolvedValue([
      {
        id: "c1",
        riverId: "r1",
        flowRate: 500,
        gaugeHeight: 3.0,
        waterTemp: 50,
        quality: "good",
        runnability: "runnable",
        source: "usgs",
        scrapedAt: now,
        river: { id: "r1", name: "Test River", state: "CO", difficulty: "III" },
      },
    ]);

    const res = await GET(mockRequest());
    const text = await readSSEStream(res);

    // SSE events must end with \n\n
    expect(text).toContain("\n\n");
  });
});

// ─── No Auth Required ───────────────────────────────────

describe("SSE /api/sse/rivers — no authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);
    mockPrisma.hazard.findMany.mockResolvedValue([]);
    mockPrisma.dealFilterMatch.findMany.mockResolvedValue([]);
  });

  it("responds with 200 without any auth headers", async () => {
    const req = new Request("http://localhost/api/sse/rivers");
    const res = await GET(req);

    expect(res.status).toBe(200);
  });
});

// ─── Empty Initial Snapshot ─────────────────────────────

describe("SSE /api/sse/rivers — empty snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);
    mockPrisma.hazard.findMany.mockResolvedValue([]);
    mockPrisma.dealFilterMatch.findMany.mockResolvedValue([]);
  });

  it("sends retry field even with no data", async () => {
    const res = await GET(mockRequest());
    const text = await readSSEStream(res);

    expect(text).toContain("retry: 5000");
  });

  it("does not send condition-update events when no conditions", async () => {
    const res = await GET(mockRequest());
    const text = await readSSEStream(res);

    expect(text).not.toContain("event: condition-update");
  });
});

// ─── Multiple Conditions ────────────────────────────────

describe("SSE /api/sse/rivers — multiple conditions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.hazard.findMany.mockResolvedValue([]);
    mockPrisma.dealFilterMatch.findMany.mockResolvedValue([]);
  });

  it("sends separate events for each condition", async () => {
    const now = new Date();
    const older = new Date(now.getTime() - 1800 * 1000);

    mockPrisma.riverCondition.findMany.mockResolvedValue([
      {
        id: "c1",
        riverId: "r1",
        flowRate: 500,
        gaugeHeight: 3.0,
        waterTemp: 50,
        quality: "good",
        runnability: "runnable",
        source: "usgs",
        scrapedAt: now,
        river: { id: "r1", name: "River A", state: "CO", difficulty: "III" },
      },
      {
        id: "c2",
        riverId: "r2",
        flowRate: 300,
        gaugeHeight: 2.5,
        waterTemp: 55,
        quality: "fair",
        runnability: "too_low",
        source: "aw",
        scrapedAt: older,
        river: { id: "r2", name: "River B", state: "UT", difficulty: "II" },
      },
    ]);

    const res = await GET(mockRequest());
    const text = await readSSEStream(res);

    const eventCount = (text.match(/event: condition-update/g) || []).length;
    expect(eventCount).toBe(2);
  });
});
