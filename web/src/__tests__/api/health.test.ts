/**
 * Tests for the Health API route handler.
 *
 * Tests:
 * - GET /api/health (ok when DB is reachable)
 * - GET /api/health (degraded when DB is unreachable)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok when database is reachable", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.version).toBe("0.1.0");
    expect(data.timestamp).toBeDefined();
  });

  it("returns degraded with 503 when database is unreachable", async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error("Connection refused"));

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.status).toBe("degraded");
    expect(data.version).toBe("0.1.0");
    expect(data.timestamp).toBeDefined();
  });

  it("returns a valid ISO timestamp", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const res = await GET();
    const data = await res.json();

    const parsed = new Date(data.timestamp);
    expect(parsed.toISOString()).toBe(data.timestamp);
  });

  it("returns version 0.1.0", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const res = await GET();
    const data = await res.json();

    expect(data.version).toBe("0.1.0");
  });

  it("degraded response still includes timestamp and version", async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error("timeout"));

    const res = await GET();
    const data = await res.json();

    expect(data.timestamp).toBeDefined();
    expect(data.version).toBe("0.1.0");
    const parsed = new Date(data.timestamp);
    expect(parsed.toISOString()).toBe(data.timestamp);
  });

  it("response has correct content-type", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const res = await GET();

    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("timestamp is close to current time", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const before = Date.now();
    const res = await GET();
    const data = await res.json();
    const after = Date.now();

    const ts = new Date(data.timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it("ok response body has exactly status, timestamp, and version keys", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const res = await GET();
    const data = await res.json();

    expect(Object.keys(data).sort()).toEqual(["status", "timestamp", "version"]);
  });

  it("degraded response body has exactly status, timestamp, and version keys", async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error("down"));

    const res = await GET();
    const data = await res.json();

    expect(Object.keys(data).sort()).toEqual(["status", "timestamp", "version"]);
  });
});
