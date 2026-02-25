/**
 * Tests for the Data Export API.
 *
 * Route: GET /api/export
 * Auth-protected endpoint to export user data in JSON, CSV, or GPX format.
 *
 * Coverage:
 * - Auth protection (401 without session)
 * - JSON export returns proper structure for each type
 * - CSV export generates valid CSV with correct headers
 * - GPX export generates valid XML with waypoints
 * - Content-Type headers for each format
 * - Content-Disposition headers with correct filenames
 * - Invalid format returns 400
 * - Invalid type returns 400
 * - "all" type includes rivers, conditions, deals
 * - Rivers with no lat/lng excluded from GPX waypoints
 * - Empty data returns valid but empty export
 * - Date range filtering for conditions (last 30 days)
 * - GPX only supports rivers or all type
 * - XML escaping in GPX
 * - CSV escaping for commas, quotes, newlines
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  userRiver: {
    findMany: vi.fn(),
  },
  river: {
    findMany: vi.fn(),
  },
  riverCondition: {
    findMany: vi.fn(),
  },
  dealFilterMatch: {
    findMany: vi.fn(),
  },
}));

const mockAuth = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

import { GET } from "@/app/api/export/route";

function mockRequest(url: string): Request {
  return new Request(url);
}

// ─── Sample Data ─────────────────────────────────────────

const SAMPLE_RIVERS = [
  {
    id: "river-1",
    name: "Colorado River",
    state: "CO",
    region: "Western Slope",
    latitude: 39.0639,
    longitude: -108.5506,
    difficulty: "III-IV",
    description: "Classic whitewater run",
  },
  {
    id: "river-2",
    name: "Green River",
    state: "UT",
    region: null,
    latitude: null,
    longitude: null,
    difficulty: "II",
    description: null,
  },
];

const SAMPLE_CONDITIONS = [
  {
    id: "cond-1",
    riverId: "river-1",
    river: { name: "Colorado River" },
    flowRate: 1200,
    gaugeHeight: 4.5,
    waterTemp: 55,
    quality: "good",
    runnability: "runnable",
    source: "usgs",
    scrapedAt: new Date("2026-02-20T10:00:00Z"),
  },
];

const SAMPLE_MATCHES = [
  {
    id: "match-1",
    deal: {
      id: "deal-1",
      title: "NRS Otter 130",
      price: 2500,
      url: "https://example.com/deal1",
      category: "rafts",
      region: "Colorado",
      postedAt: new Date("2026-02-18T12:00:00Z"),
      scrapedAt: new Date("2026-02-18T14:00:00Z"),
    },
    filter: { id: "filter-1", name: "Raft Deals", userId: "user-1" },
    createdAt: new Date("2026-02-18T14:00:00Z"),
  },
];

describe("GET /api/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated user
    mockAuth.mockResolvedValue({ user: { id: "user-1", email: "test@example.com" } });
    // Default: user tracks two rivers
    mockPrisma.userRiver.findMany.mockResolvedValue([
      { riverId: "river-1" },
      { riverId: "river-2" },
    ]);
    // Default: empty data
    mockPrisma.river.findMany.mockResolvedValue([]);
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);
    mockPrisma.dealFilterMatch.findMany.mockResolvedValue([]);
  });

  // ─── Auth Protection ──────────────────────────────────

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = mockRequest("http://localhost/api/export?format=json&type=rivers");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain("Authentication required");
  });

  it("returns 401 when session has no user id", async () => {
    mockAuth.mockResolvedValue({ user: { email: "no-id@test.com" } });
    const req = mockRequest("http://localhost/api/export?format=json&type=rivers");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  // ─── Validation ───────────────────────────────────────

  it("returns 400 when format is missing", async () => {
    const req = mockRequest("http://localhost/api/export?type=rivers");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });

  it("returns 400 when type is missing", async () => {
    const req = mockRequest("http://localhost/api/export?format=json");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });

  it("returns 400 for invalid format", async () => {
    const req = mockRequest("http://localhost/api/export?format=xml&type=rivers");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid type", async () => {
    const req = mockRequest("http://localhost/api/export?format=json&type=users");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when both params are invalid", async () => {
    const req = mockRequest("http://localhost/api/export?format=pdf&type=users");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  // ─── JSON Export ──────────────────────────────────────

  it("returns JSON with correct Content-Type header", async () => {
    const req = mockRequest("http://localhost/api/export?format=json&type=rivers");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
  });

  it("returns JSON with correct Content-Disposition filename", async () => {
    const req = mockRequest("http://localhost/api/export?format=json&type=rivers");
    const res = await GET(req);
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="water-watcher-rivers-export.json"'
    );
  });

  it("returns rivers JSON with proper structure", async () => {
    mockPrisma.river.findMany.mockResolvedValue(SAMPLE_RIVERS);
    const req = mockRequest("http://localhost/api/export?format=json&type=rivers");
    const res = await GET(req);
    const data = await res.json();

    expect(data.rivers).toHaveLength(2);
    expect(data.rivers[0].id).toBe("river-1");
    expect(data.rivers[0].name).toBe("Colorado River");
    expect(data.rivers[0].state).toBe("CO");
    expect(data.rivers[0].latitude).toBe(39.0639);
    expect(data.rivers[0].longitude).toBe(-108.5506);
  });

  it("returns conditions JSON with proper structure", async () => {
    mockPrisma.riverCondition.findMany.mockResolvedValue(SAMPLE_CONDITIONS);
    const req = mockRequest("http://localhost/api/export?format=json&type=conditions");
    const res = await GET(req);
    const data = await res.json();

    expect(data.conditions).toHaveLength(1);
    expect(data.conditions[0].riverId).toBe("river-1");
    expect(data.conditions[0].riverName).toBe("Colorado River");
    expect(data.conditions[0].flowRate).toBe(1200);
    expect(data.conditions[0].scrapedAt).toBe("2026-02-20T10:00:00.000Z");
  });

  it("returns deals JSON with proper structure", async () => {
    mockPrisma.dealFilterMatch.findMany.mockResolvedValue(SAMPLE_MATCHES);
    const req = mockRequest("http://localhost/api/export?format=json&type=deals");
    const res = await GET(req);
    const data = await res.json();

    expect(data.deals).toHaveLength(1);
    expect(data.deals[0].id).toBe("deal-1");
    expect(data.deals[0].title).toBe("NRS Otter 130");
    expect(data.deals[0].price).toBe(2500);
    expect(data.deals[0].url).toBe("https://example.com/deal1");
  });

  it("returns all types in JSON when type=all", async () => {
    mockPrisma.river.findMany.mockResolvedValue(SAMPLE_RIVERS);
    mockPrisma.riverCondition.findMany.mockResolvedValue(SAMPLE_CONDITIONS);
    mockPrisma.dealFilterMatch.findMany.mockResolvedValue(SAMPLE_MATCHES);

    const req = mockRequest("http://localhost/api/export?format=json&type=all");
    const res = await GET(req);
    const data = await res.json();

    expect(data.rivers).toHaveLength(2);
    expect(data.conditions).toHaveLength(1);
    expect(data.deals).toHaveLength(1);
  });

  it("returns JSON Content-Disposition for type=all", async () => {
    const req = mockRequest("http://localhost/api/export?format=json&type=all");
    const res = await GET(req);
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="water-watcher-all-export.json"'
    );
  });

  it("returns empty JSON for rivers when user tracks no rivers", async () => {
    mockPrisma.userRiver.findMany.mockResolvedValue([]);
    mockPrisma.river.findMany.mockResolvedValue([]);
    const req = mockRequest("http://localhost/api/export?format=json&type=rivers");
    const res = await GET(req);
    const data = await res.json();
    expect(data.rivers).toHaveLength(0);
  });

  // ─── CSV Export ───────────────────────────────────────

  it("returns CSV with correct Content-Type header", async () => {
    const req = mockRequest("http://localhost/api/export?format=csv&type=rivers");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
  });

  it("returns CSV with correct Content-Disposition filename", async () => {
    const req = mockRequest("http://localhost/api/export?format=csv&type=rivers");
    const res = await GET(req);
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="water-watcher-rivers-export.csv"'
    );
  });

  it("generates CSV with proper header row for rivers", async () => {
    mockPrisma.river.findMany.mockResolvedValue(SAMPLE_RIVERS);
    const req = mockRequest("http://localhost/api/export?format=csv&type=rivers");
    const res = await GET(req);
    const text = await res.text();

    // Should have header row
    expect(text).toContain("id,name,state,region,latitude,longitude,difficulty,description");
    // Should have data
    expect(text).toContain("Colorado River");
    expect(text).toContain("river-1");
  });

  it("generates CSV with proper header row for conditions", async () => {
    mockPrisma.riverCondition.findMany.mockResolvedValue(SAMPLE_CONDITIONS);
    const req = mockRequest("http://localhost/api/export?format=csv&type=conditions");
    const res = await GET(req);
    const text = await res.text();

    expect(text).toContain("id,river_id,river_name,flow_rate,gauge_height,water_temp,quality,runnability,source,scraped_at");
    expect(text).toContain("cond-1");
  });

  it("generates CSV with proper header row for deals", async () => {
    mockPrisma.dealFilterMatch.findMany.mockResolvedValue(SAMPLE_MATCHES);
    const req = mockRequest("http://localhost/api/export?format=csv&type=deals");
    const res = await GET(req);
    const text = await res.text();

    expect(text).toContain("id,title,price,url,category,region,posted_at,scraped_at");
    expect(text).toContain("NRS Otter 130");
  });

  it("generates CSV with all sections when type=all", async () => {
    mockPrisma.river.findMany.mockResolvedValue(SAMPLE_RIVERS);
    mockPrisma.riverCondition.findMany.mockResolvedValue(SAMPLE_CONDITIONS);
    mockPrisma.dealFilterMatch.findMany.mockResolvedValue(SAMPLE_MATCHES);

    const req = mockRequest("http://localhost/api/export?format=csv&type=all");
    const res = await GET(req);
    const text = await res.text();

    expect(text).toContain("# Rivers");
    expect(text).toContain("# Conditions (last 30 days)");
    expect(text).toContain("# Matched Deals");
  });

  it("escapes CSV values containing commas", async () => {
    mockPrisma.river.findMany.mockResolvedValue([
      {
        id: "r1",
        name: "River, with comma",
        state: "CO",
        region: null,
        latitude: 39.0,
        longitude: -108.0,
        difficulty: "III",
        description: "Has, commas, in it",
      },
    ]);

    const req = mockRequest("http://localhost/api/export?format=csv&type=rivers");
    const res = await GET(req);
    const text = await res.text();

    // Comma-containing values should be quoted
    expect(text).toContain('"River, with comma"');
    expect(text).toContain('"Has, commas, in it"');
  });

  it("escapes CSV values containing quotes", async () => {
    mockPrisma.river.findMany.mockResolvedValue([
      {
        id: "r1",
        name: 'River "The Big One"',
        state: "CO",
        region: null,
        latitude: 39.0,
        longitude: -108.0,
        difficulty: "III",
        description: null,
      },
    ]);

    const req = mockRequest("http://localhost/api/export?format=csv&type=rivers");
    const res = await GET(req);
    const text = await res.text();

    // Quotes should be escaped as double-quotes
    expect(text).toContain('"River ""The Big One"""');
  });

  it("returns empty CSV for empty data", async () => {
    const req = mockRequest("http://localhost/api/export?format=csv&type=rivers");
    const res = await GET(req);
    const text = await res.text();

    // Should still have the section header and column headers
    expect(text).toContain("# Rivers");
    expect(text).toContain("id,name,state,region");
    // But no data rows
    const lines = text.split("\n").filter((l) => l.trim() && !l.startsWith("#") && !l.startsWith("id,"));
    expect(lines).toHaveLength(0);
  });

  // ─── GPX Export ───────────────────────────────────────

  it("returns GPX with correct Content-Type header", async () => {
    mockPrisma.river.findMany.mockResolvedValue(SAMPLE_RIVERS);
    const req = mockRequest("http://localhost/api/export?format=gpx&type=rivers");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/gpx+xml");
  });

  it("returns GPX with correct Content-Disposition filename", async () => {
    mockPrisma.river.findMany.mockResolvedValue(SAMPLE_RIVERS);
    const req = mockRequest("http://localhost/api/export?format=gpx&type=rivers");
    const res = await GET(req);
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="water-watcher-rivers.gpx"'
    );
  });

  it("generates valid GPX XML with waypoints", async () => {
    mockPrisma.river.findMany.mockResolvedValue(SAMPLE_RIVERS);
    const req = mockRequest("http://localhost/api/export?format=gpx&type=rivers");
    const res = await GET(req);
    const text = await res.text();

    expect(text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(text).toContain("<gpx");
    expect(text).toContain("</gpx>");
    expect(text).toContain("<metadata>");
    expect(text).toContain("<name>Water Watcher - Tracked Rivers</name>");
  });

  it("includes waypoints only for rivers with lat/lng", async () => {
    mockPrisma.river.findMany.mockResolvedValue(SAMPLE_RIVERS);
    const req = mockRequest("http://localhost/api/export?format=gpx&type=rivers");
    const res = await GET(req);
    const text = await res.text();

    // river-1 has lat/lng, should be a waypoint
    expect(text).toContain('<wpt lat="39.0639" lon="-108.5506">');
    expect(text).toContain("<name>Colorado River</name>");

    // river-2 has null lat/lng, should NOT be a waypoint
    expect(text).not.toContain("Green River");
  });

  it("excludes rivers without lat/lng from GPX", async () => {
    mockPrisma.river.findMany.mockResolvedValue([
      {
        id: "r1",
        name: "No Location River",
        state: "CO",
        region: null,
        latitude: null,
        longitude: null,
        difficulty: "II",
        description: null,
      },
    ]);

    const req = mockRequest("http://localhost/api/export?format=gpx&type=rivers");
    const res = await GET(req);
    const text = await res.text();

    expect(text).not.toContain("<wpt");
    expect(text).toContain("<gpx"); // Still valid GPX, just no waypoints
    expect(text).toContain("</gpx>");
  });

  it("returns 400 for GPX with conditions type", async () => {
    const req = mockRequest("http://localhost/api/export?format=gpx&type=conditions");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("GPX");
  });

  it("returns 400 for GPX with deals type", async () => {
    const req = mockRequest("http://localhost/api/export?format=gpx&type=deals");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("GPX");
  });

  it("allows GPX with type=all (uses rivers data)", async () => {
    mockPrisma.river.findMany.mockResolvedValue(SAMPLE_RIVERS);
    const req = mockRequest("http://localhost/api/export?format=gpx&type=all");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("<gpx");
    expect(text).toContain("Colorado River");
  });

  it("escapes XML special characters in GPX", async () => {
    mockPrisma.river.findMany.mockResolvedValue([
      {
        id: "r1",
        name: 'River <with> "special" & chars',
        state: "CO",
        region: "O'Brien's Valley",
        latitude: 39.0,
        longitude: -108.0,
        difficulty: "III",
        description: null,
      },
    ]);

    const req = mockRequest("http://localhost/api/export?format=gpx&type=rivers");
    const res = await GET(req);
    const text = await res.text();

    expect(text).toContain("River &lt;with&gt; &quot;special&quot; &amp; chars");
    expect(text).toContain("O&apos;Brien&apos;s Valley");
  });

  it("generates GPX with desc field combining state, region, difficulty", async () => {
    mockPrisma.river.findMany.mockResolvedValue([SAMPLE_RIVERS[0]]);
    const req = mockRequest("http://localhost/api/export?format=gpx&type=rivers");
    const res = await GET(req);
    const text = await res.text();

    expect(text).toContain("<desc>CO | Western Slope | III-IV</desc>");
  });

  // ─── Date Range Filtering ────────────────────────────

  it("queries conditions from the last 30 days", async () => {
    mockPrisma.riverCondition.findMany.mockResolvedValue([]);
    const req = mockRequest("http://localhost/api/export?format=json&type=conditions");
    await GET(req);

    expect(mockPrisma.riverCondition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          scrapedAt: { gte: expect.any(Date) },
        }),
      })
    );

    // Verify the date is approximately 30 days ago
    const call = mockPrisma.riverCondition.findMany.mock.calls[0][0];
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const queryDate = call.where.scrapedAt.gte.getTime();
    expect(Math.abs(queryDate - thirtyDaysAgo)).toBeLessThan(5000); // within 5s
  });

  // ─── User Scoping ────────────────────────────────────

  it("fetches only rivers tracked by the authenticated user", async () => {
    const req = mockRequest("http://localhost/api/export?format=json&type=rivers");
    await GET(req);

    expect(mockPrisma.userRiver.findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { riverId: true },
    });
  });

  it("filters conditions by user's tracked river IDs", async () => {
    mockPrisma.userRiver.findMany.mockResolvedValue([
      { riverId: "river-1" },
      { riverId: "river-2" },
    ]);
    const req = mockRequest("http://localhost/api/export?format=json&type=conditions");
    await GET(req);

    expect(mockPrisma.riverCondition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          riverId: { in: ["river-1", "river-2"] },
        }),
      })
    );
  });

  // ─── Error Handling ──────────────────────────────────

  it("returns 500 on database error", async () => {
    mockPrisma.userRiver.findMany.mockRejectedValue(new Error("DB down"));
    const req = mockRequest("http://localhost/api/export?format=json&type=rivers");
    const res = await GET(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal server error");
  });

  // ─── Deals user scoping ──────────────────────────────

  it("fetches deals matched by user's filters", async () => {
    const req = mockRequest("http://localhost/api/export?format=json&type=deals");
    await GET(req);

    expect(mockPrisma.dealFilterMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          filter: { userId: "user-1" },
        },
      })
    );
  });

  // ─── Content-Disposition for each format/type combo ──

  it("has correct filename for CSV conditions export", async () => {
    const req = mockRequest("http://localhost/api/export?format=csv&type=conditions");
    const res = await GET(req);
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="water-watcher-conditions-export.csv"'
    );
  });

  it("has correct filename for JSON deals export", async () => {
    const req = mockRequest("http://localhost/api/export?format=json&type=deals");
    const res = await GET(req);
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="water-watcher-deals-export.json"'
    );
  });
});
