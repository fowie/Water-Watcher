/**
 * Tests for the SSE Rivers endpoint.
 *
 * Route: GET /api/sse/rivers
 * Server-Sent Events for real-time river condition updates.
 *
 * Coverage:
 * - Response headers (text/event-stream, no-cache, keep-alive)
 * - Retry field is sent first
 * - Initial snapshot sends recent conditions, hazards, deal matches
 * - Empty database returns empty initial snapshot (no events)
 * - Event format: "event: <type>\ndata: <json>\n\n"
 * - Handles Prisma errors gracefully during initial snapshot
 * - Multiple conditions are each sent as separate events
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

function makeSSERequest(headers?: Record<string, string>): Request {
  return new Request("http://localhost/api/sse/rivers", {
    headers: headers ?? {},
  });
}

/**
 * Helper: reads chunks from the SSE response stream until no more data arrives
 * within a short timeout. SSE streams never close on their own (long-lived),
 * so we use a race to break after the initial snapshot is sent.
 */
async function readSSEStream(response: Response, waitMs = 500): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let result = "";

  // Keep reading until we time out waiting for the next chunk
  // The initial snapshot sends data synchronously (within the start() callback),
  // then the stream goes quiet until the next 30s poll interval.
  try {
    while (true) {
      const chunk = await Promise.race([
        reader.read(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), waitMs)),
      ]);
      if (chunk === null) break; // timeout — no more data available
      if (chunk.done) break;
      if (chunk.value) result += decoder.decode(chunk.value, { stream: true });
    }
  } finally {
    // Cancel the stream to clean up the interval timer inside the route
    await reader.cancel();
  }

  return result;
}

/**
 * Parse SSE text into an array of {event, data} objects.
 */
function parseSSEEvents(text: string): Array<{ event?: string; data?: string; raw: string }> {
  const blocks = text.split("\n\n").filter((b) => b.trim());
  return blocks.map((block) => {
    const eventMatch = block.match(/^event: (.+)$/m);
    const dataMatch = block.match(/^data: (.+)$/m);
    const retryMatch = block.match(/^retry: (\d+)$/m);
    return {
      event: eventMatch?.[1],
      data: dataMatch?.[1],
      retry: retryMatch?.[1],
      raw: block,
    };
  });
}

describe("GET /api/sse/rivers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: empty results
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);
    mockPrisma.hazard.findMany.mockResolvedValue([]);
    mockPrisma.dealFilterMatch.findMany.mockResolvedValue([]);
  });

  // ─── Response Headers ────────────────────────────────

  it("returns Content-Type text/event-stream", async () => {
    const res = await GET(makeSSERequest());
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    await res.body?.cancel();
  });

  it("returns Cache-Control no-cache, no-transform", async () => {
    const res = await GET(makeSSERequest());
    expect(res.headers.get("Cache-Control")).toBe("no-cache, no-transform");
    await res.body?.cancel();
  });

  it("returns Connection keep-alive", async () => {
    const res = await GET(makeSSERequest());
    expect(res.headers.get("Connection")).toBe("keep-alive");
    await res.body?.cancel();
  });

  it("returns X-Accel-Buffering no header", async () => {
    const res = await GET(makeSSERequest());
    expect(res.headers.get("X-Accel-Buffering")).toBe("no");
    await res.body?.cancel();
  });

  // ─── Retry Directive ─────────────────────────────────

  it("sends retry:5000 directive as first message", async () => {
    const res = await GET(makeSSERequest());
    const text = await readSSEStream(res);
    // First block should be retry
    expect(text).toContain("retry: 5000");
    // Retry should appear before any event
    const retryIdx = text.indexOf("retry: 5000");
    const eventIdx = text.indexOf("event:");
    if (eventIdx >= 0) {
      expect(retryIdx).toBeLessThan(eventIdx);
    }
  });

  // ─── Empty Database ──────────────────────────────────

  it("returns stream with only retry when database is empty", async () => {
    const res = await GET(makeSSERequest());
    const text = await readSSEStream(res);
    const events = parseSSEEvents(text);

    // Should only have the retry directive, no condition-update/hazard-alert/deal-match events
    const dataEvents = events.filter((e) => e.event);
    expect(dataEvents).toHaveLength(0);
  });

  // ─── Condition Updates ────────────────────────────────

  it("sends condition-update events for recent conditions", async () => {
    const mockConditions = [
      {
        id: "cond-1",
        riverId: "river-1",
        river: { id: "river-1", name: "Colorado River", state: "CO", difficulty: "III" },
        flowRate: 1200,
        gaugeHeight: 4.5,
        waterTemp: 55,
        quality: "good",
        runnability: "runnable",
        source: "usgs",
        scrapedAt: new Date("2026-02-24T10:00:00Z"),
      },
    ];
    mockPrisma.riverCondition.findMany.mockResolvedValue(mockConditions);

    const res = await GET(makeSSERequest());
    const text = await readSSEStream(res);
    const events = parseSSEEvents(text);

    const condEvents = events.filter((e) => e.event === "condition-update");
    expect(condEvents).toHaveLength(1);

    const data = JSON.parse(condEvents[0].data!);
    expect(data.id).toBe("cond-1");
    expect(data.riverId).toBe("river-1");
    expect(data.riverName).toBe("Colorado River");
    expect(data.state).toBe("CO");
    expect(data.flowRate).toBe(1200);
    expect(data.gaugeHeight).toBe(4.5);
    expect(data.waterTemp).toBe(55);
    expect(data.quality).toBe("good");
    expect(data.runnability).toBe("runnable");
    expect(data.source).toBe("usgs");
    expect(data.scrapedAt).toBe("2026-02-24T10:00:00.000Z");
  });

  it("sends multiple condition-update events for multiple conditions", async () => {
    const now = new Date();
    const mockConditions = [
      {
        id: "cond-1",
        riverId: "river-1",
        river: { id: "river-1", name: "River A", state: "CO", difficulty: "III" },
        flowRate: 500,
        gaugeHeight: 3.0,
        waterTemp: null,
        quality: "fair",
        runnability: "low",
        source: "usgs",
        scrapedAt: now,
      },
      {
        id: "cond-2",
        riverId: "river-2",
        river: { id: "river-2", name: "River B", state: "UT", difficulty: "IV" },
        flowRate: 2000,
        gaugeHeight: 6.0,
        waterTemp: 60,
        quality: "excellent",
        runnability: "optimal",
        source: "aw",
        scrapedAt: now,
      },
    ];
    mockPrisma.riverCondition.findMany.mockResolvedValue(mockConditions);

    const res = await GET(makeSSERequest());
    const text = await readSSEStream(res);
    const events = parseSSEEvents(text);

    const condEvents = events.filter((e) => e.event === "condition-update");
    expect(condEvents).toHaveLength(2);
  });

  // ─── Hazard Alerts ────────────────────────────────────

  it("sends hazard-alert events for active hazards", async () => {
    const mockHazards = [
      {
        id: "haz-1",
        riverId: "river-1",
        river: { id: "river-1", name: "Snake River" },
        type: "strainer",
        severity: "high",
        title: "Large strainer at mile marker 5",
        description: "Multiple logs blocking main channel",
        reportedAt: new Date("2026-02-24T08:00:00Z"),
        isActive: true,
      },
    ];
    mockPrisma.hazard.findMany.mockResolvedValue(mockHazards);

    const res = await GET(makeSSERequest());
    const text = await readSSEStream(res);
    const events = parseSSEEvents(text);

    const hazEvents = events.filter((e) => e.event === "hazard-alert");
    expect(hazEvents).toHaveLength(1);

    const data = JSON.parse(hazEvents[0].data!);
    expect(data.id).toBe("haz-1");
    expect(data.riverId).toBe("river-1");
    expect(data.riverName).toBe("Snake River");
    expect(data.type).toBe("strainer");
    expect(data.severity).toBe("high");
    expect(data.title).toBe("Large strainer at mile marker 5");
    expect(data.description).toBe("Multiple logs blocking main channel");
    expect(data.reportedAt).toBe("2026-02-24T08:00:00.000Z");
  });

  // ─── Deal Match Events ───────────────────────────────

  it("sends deal-match events for recent matches", async () => {
    const mockMatches = [
      {
        id: "match-1",
        deal: {
          id: "deal-1",
          title: "NRS Otter 140",
          price: 3500,
          url: "https://example.com/deal1",
          category: "rafts",
        },
        createdAt: new Date("2026-02-24T09:00:00Z"),
      },
    ];
    mockPrisma.dealFilterMatch.findMany.mockResolvedValue(mockMatches);

    const res = await GET(makeSSERequest());
    const text = await readSSEStream(res);
    const events = parseSSEEvents(text);

    const dealEvents = events.filter((e) => e.event === "deal-match");
    expect(dealEvents).toHaveLength(1);

    const data = JSON.parse(dealEvents[0].data!);
    expect(data.matchId).toBe("match-1");
    expect(data.dealId).toBe("deal-1");
    expect(data.dealTitle).toBe("NRS Otter 140");
    expect(data.dealPrice).toBe(3500);
    expect(data.dealUrl).toBe("https://example.com/deal1");
    expect(data.category).toBe("rafts");
    expect(data.filterId).toBeUndefined(); // filter info intentionally excluded (security)
    expect(data.filterName).toBeUndefined();
    expect(data.userId).toBeUndefined(); // userId intentionally excluded (security)
    expect(data.matchedAt).toBe("2026-02-24T09:00:00.000Z");
  });

  // ─── Combined initial snapshot ───────────────────────

  it("sends all event types in initial snapshot", async () => {
    const now = new Date();
    mockPrisma.riverCondition.findMany.mockResolvedValue([
      {
        id: "c1", riverId: "r1",
        river: { id: "r1", name: "R1", state: "CO", difficulty: "II" },
        flowRate: 100, gaugeHeight: 2, waterTemp: null,
        quality: null, runnability: null, source: "usgs", scrapedAt: now,
      },
    ]);
    mockPrisma.hazard.findMany.mockResolvedValue([
      {
        id: "h1", riverId: "r1",
        river: { id: "r1", name: "R1" },
        type: "flood", severity: "critical",
        title: "Flood warning", description: null,
        reportedAt: now, isActive: true,
      },
    ]);
    mockPrisma.dealFilterMatch.findMany.mockResolvedValue([
      {
        id: "m1",
        deal: { id: "d1", title: "Deal 1", price: null, url: "http://x.com", category: null },
        createdAt: now,
      },
    ]);

    const res = await GET(makeSSERequest());
    const text = await readSSEStream(res);
    const events = parseSSEEvents(text);

    expect(events.some((e) => e.event === "condition-update")).toBe(true);
    expect(events.some((e) => e.event === "hazard-alert")).toBe(true);
    expect(events.some((e) => e.event === "deal-match")).toBe(true);
  });

  // ─── Prisma Query Structure ──────────────────────────

  it("queries conditions from the last hour with descending order", async () => {
    const res = await GET(makeSSERequest());
    await readSSEStream(res);

    expect(mockPrisma.riverCondition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { scrapedAt: { gte: expect.any(Date) } },
        orderBy: { scrapedAt: "desc" },
        take: 50,
      })
    );

    // Verify the date is approximately 1 hour ago
    const call = mockPrisma.riverCondition.findMany.mock.calls[0][0];
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const queryDate = call.where.scrapedAt.gte.getTime();
    expect(Math.abs(queryDate - oneHourAgo)).toBeLessThan(5000); // within 5s
  });

  it("queries only active hazards from the last hour", async () => {
    const res = await GET(makeSSERequest());
    await readSSEStream(res);

    expect(mockPrisma.hazard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          reportedAt: { gte: expect.any(Date) },
          isActive: true,
        },
        orderBy: { reportedAt: "desc" },
        take: 20,
      })
    );
  });

  it("queries deal filter matches from the last hour", async () => {
    const res = await GET(makeSSERequest());
    await readSSEStream(res);

    expect(mockPrisma.dealFilterMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { createdAt: { gte: expect.any(Date) } },
        orderBy: { createdAt: "desc" },
        take: 20,
      })
    );
  });

  // ─── Error Handling ──────────────────────────────────

  it("handles Prisma error during initial snapshot gracefully (stream still opened)", async () => {
    mockPrisma.riverCondition.findMany.mockRejectedValue(new Error("DB connection failed"));
    // The stream should still be returned as a valid response

    const res = await GET(makeSSERequest());
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    // Stream is still created despite the error
    expect(res.body).toBeTruthy();
    await res.body?.cancel();
  });

  // ─── SSE Format ──────────────────────────────────────

  it("formats SSE events correctly with event: and data: lines", async () => {
    mockPrisma.riverCondition.findMany.mockResolvedValue([
      {
        id: "c1", riverId: "r1",
        river: { id: "r1", name: "Test River", state: "CO", difficulty: "II" },
        flowRate: 500, gaugeHeight: 3, waterTemp: 50,
        quality: "good", runnability: "runnable", source: "usgs",
        scrapedAt: new Date("2026-02-24T10:00:00Z"),
      },
    ]);

    const res = await GET(makeSSERequest());
    const text = await readSSEStream(res);

    // Verify SSE format: optional id line, event line followed by data line
    expect(text).toMatch(/(?:id: .+\n)?event: condition-update\ndata: \{.*\}\n\n/);
  });

  // ─── Null fields ──────────────────────────────────────

  it("handles null optional fields in conditions", async () => {
    mockPrisma.riverCondition.findMany.mockResolvedValue([
      {
        id: "c1", riverId: "r1",
        river: { id: "r1", name: "Sparse River", state: "CO", difficulty: null },
        flowRate: null, gaugeHeight: null, waterTemp: null,
        quality: null, runnability: null, source: "aw",
        scrapedAt: new Date(),
      },
    ]);

    const res = await GET(makeSSERequest());
    const text = await readSSEStream(res);
    const events = parseSSEEvents(text);
    const condEvents = events.filter((e) => e.event === "condition-update");
    expect(condEvents).toHaveLength(1);

    const data = JSON.parse(condEvents[0].data!);
    expect(data.flowRate).toBeNull();
    expect(data.gaugeHeight).toBeNull();
    expect(data.waterTemp).toBeNull();
    expect(data.quality).toBeNull();
    expect(data.runnability).toBeNull();
  });

  it("handles null description in hazards", async () => {
    mockPrisma.hazard.findMany.mockResolvedValue([
      {
        id: "h1", riverId: "r1",
        river: { id: "r1", name: "Test" },
        type: "flood", severity: "low",
        title: "Minor flooding", description: null,
        reportedAt: new Date(), isActive: true,
      },
    ]);

    const res = await GET(makeSSERequest());
    const text = await readSSEStream(res);
    const events = parseSSEEvents(text);
    const hazEvents = events.filter((e) => e.event === "hazard-alert");
    expect(hazEvents).toHaveLength(1);
    const data = JSON.parse(hazEvents[0].data!);
    expect(data.description).toBeNull();
  });

  it("handles null deal price and category", async () => {
    mockPrisma.dealFilterMatch.findMany.mockResolvedValue([
      {
        id: "m1",
        deal: { id: "d1", title: "Free item", price: null, url: "http://x.com", category: null },
        createdAt: new Date(),
      },
    ]);

    const res = await GET(makeSSERequest());
    const text = await readSSEStream(res);
    const events = parseSSEEvents(text);
    const dealEvents = events.filter((e) => e.event === "deal-match");
    expect(dealEvents).toHaveLength(1);
    const data = JSON.parse(dealEvents[0].data!);
    expect(data.dealPrice).toBeNull();
    expect(data.category).toBeNull();
  });
});
