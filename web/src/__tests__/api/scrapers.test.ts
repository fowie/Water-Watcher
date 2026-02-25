/**
 * Tests for the Scraper Stats API route handlers (admin).
 *
 * Routes:
 *   GET /api/admin/scrapers          — scraper summary grouped by source (auth)
 *   GET /api/admin/scrapers/:source  — detailed scrape history (auth)
 *
 * Coverage:
 * - GET /api/admin/scrapers requires auth (401)
 * - GET returns scraper summary grouped by source
 * - Summary includes: lastScrapeAt, totalScrapes24h, successCount24h, itemsScraped24h
 * - System stats: totalRiversTracked, conditionsLast24h, activeHazards
 * - GET /api/admin/scrapers/:source returns detailed history
 * - Detail includes scrape log entries with status, items, duration
 * - Detail includes aggregate stats (successRate, avgItemsPerRun)
 * - Invalid source param handling
 * - Empty scrape log returns sensible defaults (zeros)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  scrapeLog: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    aggregate: vi.fn(),
    count: vi.fn(),
  },
  river: {
    count: vi.fn(),
  },
  riverCondition: {
    count: vi.fn(),
  },
  hazard: {
    count: vi.fn(),
  },
}));

const mockAuth = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

import { GET } from "@/app/api/admin/scrapers/route";
import { GET as GET_SOURCE } from "@/app/api/admin/scrapers/[source]/route";

function mockRequest(url: string): Request {
  return new Request(url);
}

function makeSourceContext(source: string) {
  return { params: Promise.resolve({ source }) };
}

const USER_ID = "admin-1";

const SAMPLE_SCRAPE_LOG = {
  id: "log-1",
  source: "usgs",
  status: "success",
  itemCount: 25,
  error: null,
  duration: 1500,
  startedAt: new Date("2026-02-24T10:00:00Z"),
  finishedAt: new Date("2026-02-24T10:00:01.5Z"),
};

const SAMPLE_FAILED_LOG = {
  id: "log-2",
  source: "usgs",
  status: "error",
  itemCount: 0,
  error: "Connection timeout",
  duration: 5000,
  startedAt: new Date("2026-02-24T08:00:00Z"),
  finishedAt: new Date("2026-02-24T08:00:05Z"),
};

describe("GET /api/admin/scrapers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: USER_ID, role: "admin" } });
    // Default: all sources return empty data
    mockPrisma.scrapeLog.findMany.mockResolvedValue([]);
    mockPrisma.scrapeLog.findFirst.mockResolvedValue(null);
    mockPrisma.scrapeLog.aggregate.mockResolvedValue({ _sum: { itemCount: null } });
    mockPrisma.river.count.mockResolvedValue(0);
    mockPrisma.riverCondition.count.mockResolvedValue(0);
    mockPrisma.hazard.count.mockResolvedValue(0);
  });

  it("returns 401 without auth", async () => {
    mockAuth.mockResolvedValue(null);

    const req = mockRequest("http://localhost/api/admin/scrapers");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain("Authentication required");
  });

  it("returns 401 when session has no user id", async () => {
    mockAuth.mockResolvedValue({ user: { name: "Test" } });

    const req = mockRequest("http://localhost/api/admin/scrapers");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1", role: "user" } });

    const req = mockRequest("http://localhost/api/admin/scrapers");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain("Admin access required");
  });

  it("returns 403 when role is undefined (not admin)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const req = mockRequest("http://localhost/api/admin/scrapers");
    const res = await GET(req);

    expect(res.status).toBe(403);
  });

  it("returns scraper summary grouped by source", async () => {
    const req = mockRequest("http://localhost/api/admin/scrapers");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.scrapers).toBeDefined();
    expect(Array.isArray(data.scrapers)).toBe(true);

    // Should have all 5 sources
    const sources = data.scrapers.map((s: { source: string }) => s.source);
    expect(sources).toContain("usgs");
    expect(sources).toContain("aw");
    expect(sources).toContain("craigslist");
    expect(sources).toContain("blm");
    expect(sources).toContain("usfs");
    expect(data.scrapers).toHaveLength(5);
  });

  it("each scraper entry has expected fields", async () => {
    const req = mockRequest("http://localhost/api/admin/scrapers");
    const res = await GET(req);
    const data = await res.json();

    for (const scraper of data.scrapers) {
      expect(scraper).toHaveProperty("source");
      expect(scraper).toHaveProperty("lastScrapeAt");
      expect(scraper).toHaveProperty("lastStatus");
      expect(scraper).toHaveProperty("totalScrapes24h");
      expect(scraper).toHaveProperty("successCount24h");
      expect(scraper).toHaveProperty("itemsScraped24h");
      expect(scraper).toHaveProperty("avgDurationMs");
    }
  });

  it("populates lastScrapeAt from most recent scrape log", async () => {
    mockPrisma.scrapeLog.findFirst.mockResolvedValue(SAMPLE_SCRAPE_LOG);

    const req = mockRequest("http://localhost/api/admin/scrapers");
    const res = await GET(req);
    const data = await res.json();

    // At least one scraper should have lastScrapeAt
    const usgs = data.scrapers.find((s: { source: string }) => s.source === "usgs");
    expect(usgs.lastScrapeAt).toBeDefined();
    expect(usgs.lastStatus).toBe("success");
  });

  it("counts success scrapes in 24h", async () => {
    mockPrisma.scrapeLog.findMany.mockResolvedValue([
      SAMPLE_SCRAPE_LOG,
      SAMPLE_FAILED_LOG,
    ]);

    const req = mockRequest("http://localhost/api/admin/scrapers");
    const res = await GET(req);
    const data = await res.json();

    // Each source calls findMany with its source filter,
    // but our mock returns the same array for all calls
    const usgs = data.scrapers.find((s: { source: string }) => s.source === "usgs");
    expect(usgs.totalScrapes24h).toBe(2);
    expect(usgs.successCount24h).toBe(1);
  });

  it("includes itemsScraped24h from aggregate sum", async () => {
    mockPrisma.scrapeLog.findMany.mockResolvedValue([SAMPLE_SCRAPE_LOG]);
    mockPrisma.scrapeLog.aggregate.mockResolvedValue({ _sum: { itemCount: 42 } });

    const req = mockRequest("http://localhost/api/admin/scrapers");
    const res = await GET(req);
    const data = await res.json();

    const usgs = data.scrapers.find((s: { source: string }) => s.source === "usgs");
    expect(usgs.itemsScraped24h).toBe(42);
  });

  it("calculates avgDurationMs from logs", async () => {
    mockPrisma.scrapeLog.findMany.mockResolvedValue([
      { ...SAMPLE_SCRAPE_LOG, duration: 1000 },
      { ...SAMPLE_SCRAPE_LOG, duration: 3000 },
    ]);

    const req = mockRequest("http://localhost/api/admin/scrapers");
    const res = await GET(req);
    const data = await res.json();

    const usgs = data.scrapers.find((s: { source: string }) => s.source === "usgs");
    expect(usgs.avgDurationMs).toBe(2000);
  });

  it("returns null avgDurationMs when no duration data", async () => {
    mockPrisma.scrapeLog.findMany.mockResolvedValue([
      { ...SAMPLE_SCRAPE_LOG, duration: null },
    ]);

    const req = mockRequest("http://localhost/api/admin/scrapers");
    const res = await GET(req);
    const data = await res.json();

    const usgs = data.scrapers.find((s: { source: string }) => s.source === "usgs");
    expect(usgs.avgDurationMs).toBeNull();
  });

  // ─── System stats ──────────────────────────────────────

  it("includes summary with totalRiversTracked", async () => {
    mockPrisma.river.count.mockResolvedValue(15);

    const req = mockRequest("http://localhost/api/admin/scrapers");
    const res = await GET(req);
    const data = await res.json();

    expect(data.summary).toBeDefined();
    expect(data.summary.totalRiversTracked).toBe(15);
  });

  it("includes conditionsLast24h count", async () => {
    mockPrisma.riverCondition.count.mockResolvedValue(8);

    const req = mockRequest("http://localhost/api/admin/scrapers");
    const res = await GET(req);
    const data = await res.json();

    expect(data.summary.conditionsLast24h).toBe(8);
  });

  it("includes activeHazards count", async () => {
    mockPrisma.hazard.count.mockResolvedValue(3);

    const req = mockRequest("http://localhost/api/admin/scrapers");
    const res = await GET(req);
    const data = await res.json();

    expect(data.summary.activeHazards).toBe(3);
  });

  it("returns zero defaults when no data exists", async () => {
    const req = mockRequest("http://localhost/api/admin/scrapers");
    const res = await GET(req);
    const data = await res.json();

    for (const scraper of data.scrapers) {
      expect(scraper.lastScrapeAt).toBeNull();
      expect(scraper.lastStatus).toBeNull();
      expect(scraper.totalScrapes24h).toBe(0);
      expect(scraper.successCount24h).toBe(0);
      expect(scraper.itemsScraped24h).toBe(0);
      expect(scraper.avgDurationMs).toBeNull();
    }
    expect(data.summary.totalRiversTracked).toBe(0);
    expect(data.summary.conditionsLast24h).toBe(0);
    expect(data.summary.activeHazards).toBe(0);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.scrapeLog.findMany.mockRejectedValue(new Error("DB down"));

    const req = mockRequest("http://localhost/api/admin/scrapers");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });
});

describe("GET /api/admin/scrapers/:source", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: USER_ID, role: "admin" } });
    mockPrisma.scrapeLog.findMany.mockResolvedValue([]);
    mockPrisma.scrapeLog.count.mockResolvedValue(0);
    mockPrisma.scrapeLog.aggregate.mockResolvedValue({
      _sum: { itemCount: null },
      _avg: { itemCount: null, duration: null },
    });
  });

  it("returns 401 without auth", async () => {
    mockAuth.mockResolvedValue(null);

    const req = mockRequest("http://localhost/api/admin/scrapers/usgs");
    const res = await GET_SOURCE(req, makeSourceContext("usgs"));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain("Authentication required");
  });

  it("returns 403 for non-admin user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1", role: "user" } });

    const req = mockRequest("http://localhost/api/admin/scrapers/usgs");
    const res = await GET_SOURCE(req, makeSourceContext("usgs"));
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain("Admin access required");
  });

  it("returns 400 for invalid source", async () => {
    const req = mockRequest("http://localhost/api/admin/scrapers/facebook");
    const res = await GET_SOURCE(req, makeSourceContext("facebook"));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Invalid source");
    expect(data.error).toContain("usgs");
    expect(data.error).toContain("aw");
    expect(data.error).toContain("craigslist");
  });

  it("returns 400 for empty source string", async () => {
    const req = mockRequest("http://localhost/api/admin/scrapers/");
    const res = await GET_SOURCE(req, makeSourceContext(""));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Invalid source");
  });

  it("returns detailed history for valid source", async () => {
    mockPrisma.scrapeLog.findMany.mockResolvedValue([SAMPLE_SCRAPE_LOG]);
    mockPrisma.scrapeLog.count.mockResolvedValue(10);
    mockPrisma.scrapeLog.aggregate.mockResolvedValue({
      _sum: { itemCount: 250 },
      _avg: { itemCount: 25, duration: 1500 },
    });

    const req = mockRequest("http://localhost/api/admin/scrapers/usgs");
    const res = await GET_SOURCE(req, makeSourceContext("usgs"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.source).toBe("usgs");
    expect(data.logs).toBeDefined();
    expect(data.stats).toBeDefined();
  });

  it("log entries include status, itemCount, duration, startedAt, finishedAt", async () => {
    mockPrisma.scrapeLog.findMany.mockResolvedValue([SAMPLE_SCRAPE_LOG, SAMPLE_FAILED_LOG]);
    mockPrisma.scrapeLog.count.mockResolvedValue(2);
    mockPrisma.scrapeLog.aggregate.mockResolvedValue({
      _sum: { itemCount: 25 },
      _avg: { itemCount: 12.5, duration: 3250 },
    });

    const req = mockRequest("http://localhost/api/admin/scrapers/usgs");
    const res = await GET_SOURCE(req, makeSourceContext("usgs"));
    const data = await res.json();

    expect(data.logs).toHaveLength(2);
    const log = data.logs[0];
    expect(log).toHaveProperty("id");
    expect(log).toHaveProperty("status");
    expect(log).toHaveProperty("itemCount");
    expect(log).toHaveProperty("duration");
    expect(log).toHaveProperty("startedAt");
    expect(log).toHaveProperty("finishedAt");
  });

  it("log entries include error field", async () => {
    mockPrisma.scrapeLog.findMany.mockResolvedValue([SAMPLE_FAILED_LOG]);
    mockPrisma.scrapeLog.count.mockResolvedValue(1);
    mockPrisma.scrapeLog.aggregate.mockResolvedValue({
      _sum: { itemCount: 0 },
      _avg: { itemCount: 0, duration: 5000 },
    });

    const req = mockRequest("http://localhost/api/admin/scrapers/usgs");
    const res = await GET_SOURCE(req, makeSourceContext("usgs"));
    const data = await res.json();

    expect(data.logs[0].error).toBe("Connection timeout");
  });

  it("stats include successRate", async () => {
    mockPrisma.scrapeLog.findMany.mockResolvedValue([SAMPLE_SCRAPE_LOG]);
    mockPrisma.scrapeLog.count.mockImplementation(async (args: { where?: { status?: string } } = {}) => {
      if (args?.where?.status === "success") return 7;
      return 10;
    });
    mockPrisma.scrapeLog.aggregate.mockResolvedValue({
      _sum: { itemCount: 250 },
      _avg: { itemCount: 25, duration: 1500 },
    });

    const req = mockRequest("http://localhost/api/admin/scrapers/usgs");
    const res = await GET_SOURCE(req, makeSourceContext("usgs"));
    const data = await res.json();

    expect(data.stats.successRate).toBe(70);
  });

  it("stats include avgItemsPerRun", async () => {
    mockPrisma.scrapeLog.findMany.mockResolvedValue([]);
    mockPrisma.scrapeLog.count.mockResolvedValue(10);
    mockPrisma.scrapeLog.aggregate.mockResolvedValue({
      _sum: { itemCount: 250 },
      _avg: { itemCount: 25.4, duration: 1500 },
    });

    const req = mockRequest("http://localhost/api/admin/scrapers/usgs");
    const res = await GET_SOURCE(req, makeSourceContext("usgs"));
    const data = await res.json();

    // Rounded to 1 decimal
    expect(data.stats.avgItemsPerRun).toBe(25.4);
  });

  it("stats include totalItems from sum", async () => {
    mockPrisma.scrapeLog.findMany.mockResolvedValue([]);
    mockPrisma.scrapeLog.count.mockResolvedValue(5);
    mockPrisma.scrapeLog.aggregate.mockResolvedValue({
      _sum: { itemCount: 123 },
      _avg: { itemCount: 24.6, duration: 2000 },
    });

    const req = mockRequest("http://localhost/api/admin/scrapers/usgs");
    const res = await GET_SOURCE(req, makeSourceContext("usgs"));
    const data = await res.json();

    expect(data.stats.totalItems).toBe(123);
  });

  it("stats include avgDurationMs", async () => {
    mockPrisma.scrapeLog.findMany.mockResolvedValue([]);
    mockPrisma.scrapeLog.count.mockResolvedValue(5);
    mockPrisma.scrapeLog.aggregate.mockResolvedValue({
      _sum: { itemCount: 100 },
      _avg: { itemCount: 20, duration: 1234.5 },
    });

    const req = mockRequest("http://localhost/api/admin/scrapers/usgs");
    const res = await GET_SOURCE(req, makeSourceContext("usgs"));
    const data = await res.json();

    expect(data.stats.avgDurationMs).toBe(1235); // rounded
  });

  it("stats include totalScrapes count", async () => {
    mockPrisma.scrapeLog.findMany.mockResolvedValue([]);
    mockPrisma.scrapeLog.count.mockResolvedValue(42);
    mockPrisma.scrapeLog.aggregate.mockResolvedValue({
      _sum: { itemCount: null },
      _avg: { itemCount: null, duration: null },
    });

    const req = mockRequest("http://localhost/api/admin/scrapers/usgs");
    const res = await GET_SOURCE(req, makeSourceContext("usgs"));
    const data = await res.json();

    expect(data.stats.totalScrapes).toBe(42);
  });

  // ─── Empty scrape log → sensible defaults ─────────────

  it("returns zero defaults for empty scrape log", async () => {
    mockPrisma.scrapeLog.findMany.mockResolvedValue([]);
    mockPrisma.scrapeLog.count.mockResolvedValue(0);
    mockPrisma.scrapeLog.aggregate.mockResolvedValue({
      _sum: { itemCount: null },
      _avg: { itemCount: null, duration: null },
    });

    const req = mockRequest("http://localhost/api/admin/scrapers/usgs");
    const res = await GET_SOURCE(req, makeSourceContext("usgs"));
    const data = await res.json();

    expect(data.logs).toEqual([]);
    expect(data.stats.totalScrapes).toBe(0);
    expect(data.stats.successRate).toBe(0);
    expect(data.stats.avgItemsPerRun).toBe(0);
    expect(data.stats.totalItems).toBe(0);
    expect(data.stats.avgDurationMs).toBeNull();
  });

  // ─── Valid sources ─────────────────────────────────────

  it("accepts 'aw' as valid source", async () => {
    const req = mockRequest("http://localhost/api/admin/scrapers/aw");
    const res = await GET_SOURCE(req, makeSourceContext("aw"));

    expect(res.status).toBe(200);
  });

  it("accepts 'craigslist' as valid source", async () => {
    const req = mockRequest("http://localhost/api/admin/scrapers/craigslist");
    const res = await GET_SOURCE(req, makeSourceContext("craigslist"));

    expect(res.status).toBe(200);
  });

  it("accepts 'blm' as valid source", async () => {
    const req = mockRequest("http://localhost/api/admin/scrapers/blm");
    const res = await GET_SOURCE(req, makeSourceContext("blm"));

    expect(res.status).toBe(200);
  });

  it("accepts 'usfs' as valid source", async () => {
    const req = mockRequest("http://localhost/api/admin/scrapers/usfs");
    const res = await GET_SOURCE(req, makeSourceContext("usfs"));

    expect(res.status).toBe(200);
  });

  it("fetches last 50 log entries", async () => {
    mockPrisma.scrapeLog.findMany.mockResolvedValue([]);
    mockPrisma.scrapeLog.count.mockResolvedValue(0);
    mockPrisma.scrapeLog.aggregate.mockResolvedValue({
      _sum: { itemCount: null },
      _avg: { itemCount: null, duration: null },
    });

    const req = mockRequest("http://localhost/api/admin/scrapers/usgs");
    await GET_SOURCE(req, makeSourceContext("usgs"));

    expect(mockPrisma.scrapeLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { source: "usgs" },
        orderBy: { startedAt: "desc" },
        take: 50,
      })
    );
  });

  it("returns 500 on database error", async () => {
    mockPrisma.scrapeLog.findMany.mockRejectedValue(new Error("DB down"));

    const req = mockRequest("http://localhost/api/admin/scrapers/usgs");
    const res = await GET_SOURCE(req, makeSourceContext("usgs"));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });

  it("source is case-sensitive (uppercase rejected)", async () => {
    const req = mockRequest("http://localhost/api/admin/scrapers/USGS");
    const res = await GET_SOURCE(req, makeSourceContext("USGS"));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Invalid source");
  });
});
