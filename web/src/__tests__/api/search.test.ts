/**
 * Tests for the Global Search API route handler.
 *
 * Route: GET /api/search
 *
 * Coverage:
 * - Search returns grouped results (rivers, deals, trips, reviews)
 * - q param is required (400 without)
 * - Type filter: "rivers" returns only rivers
 * - Type filter: "deals" returns only deals
 * - Type filter: "trips" requires auth (401 without)
 * - Limit param clamping (max 50)
 * - Empty query returns 400
 * - Case-insensitive search
 * - totalResults count
 * - Each result has type, id, title, subtitle, url
 * - Search with no matches returns empty arrays
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  river: {
    findMany: vi.fn(),
  },
  gearDeal: {
    findMany: vi.fn(),
  },
  trip: {
    findMany: vi.fn(),
  },
  riverReview: {
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

import { GET } from "@/app/api/search/route";

function mockRequest(url: string): Request {
  return new Request(url);
}

const USER_ID = "user-1";

const SAMPLE_RIVERS = [
  { id: "r1", name: "Colorado River", state: "CO", difficulty: "III-IV" },
  { id: "r2", name: "Arkansas River", state: "CO", difficulty: "II" },
];

const SAMPLE_DEALS = [
  { id: "d1", title: "NRS Raft Sale", price: 299.99, category: "Rafts" },
  { id: "d2", title: "Dry Bag Bundle", price: 49.99, category: "Accessories" },
];

const SAMPLE_TRIPS = [
  { id: "t1", name: "Grand Canyon Trip", startDate: new Date("2026-06-15"), status: "planning" },
];

const SAMPLE_REVIEWS = [
  { id: "rv1", title: "Amazing rapids", rating: 5, riverId: "r1", river: { name: "Colorado River" } },
  { id: "rv2", title: null, rating: 3, riverId: "r2", river: { name: "Arkansas River" } },
];

describe("GET /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: USER_ID } });
    mockPrisma.river.findMany.mockResolvedValue([]);
    mockPrisma.gearDeal.findMany.mockResolvedValue([]);
    mockPrisma.trip.findMany.mockResolvedValue([]);
    mockPrisma.riverReview.findMany.mockResolvedValue([]);
  });

  // ─── q param validation ────────────────────────────────

  it("returns 400 when q param is missing", async () => {
    const req = mockRequest("http://localhost/api/search");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid input");
    expect(data.details).toBeDefined();
  });

  it("returns 400 when q param is empty string", async () => {
    const req = mockRequest("http://localhost/api/search?q=");
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  // ─── Grouped results ──────────────────────────────────

  it("returns grouped results with rivers, deals, trips, reviews", async () => {
    mockPrisma.river.findMany.mockResolvedValue(SAMPLE_RIVERS);
    mockPrisma.gearDeal.findMany.mockResolvedValue(SAMPLE_DEALS);
    mockPrisma.trip.findMany.mockResolvedValue(SAMPLE_TRIPS);
    mockPrisma.riverReview.findMany.mockResolvedValue(SAMPLE_REVIEWS);

    const req = mockRequest("http://localhost/api/search?q=river");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty("rivers");
    expect(data).toHaveProperty("deals");
    expect(data).toHaveProperty("trips");
    expect(data).toHaveProperty("reviews");
    expect(data).toHaveProperty("totalResults");
  });

  it("returns totalResults as sum of all result arrays", async () => {
    mockPrisma.river.findMany.mockResolvedValue(SAMPLE_RIVERS);
    mockPrisma.gearDeal.findMany.mockResolvedValue(SAMPLE_DEALS);
    mockPrisma.trip.findMany.mockResolvedValue(SAMPLE_TRIPS);
    mockPrisma.riverReview.findMany.mockResolvedValue(SAMPLE_REVIEWS);

    const req = mockRequest("http://localhost/api/search?q=test");
    const res = await GET(req);
    const data = await res.json();

    // 2 rivers + 2 deals + 1 trip + 2 reviews = 7
    expect(data.totalResults).toBe(7);
  });

  // ─── Result item shape ─────────────────────────────────

  it("river results have type, id, title, subtitle, url", async () => {
    mockPrisma.river.findMany.mockResolvedValue([SAMPLE_RIVERS[0]]);

    const req = mockRequest("http://localhost/api/search?q=colorado");
    const res = await GET(req);
    const data = await res.json();

    const river = data.rivers[0];
    expect(river.type).toBe("river");
    expect(river.id).toBe("r1");
    expect(river.title).toBe("Colorado River");
    expect(river.subtitle).toContain("CO");
    expect(river.subtitle).toContain("III-IV");
    expect(river.url).toBe("/rivers/r1");
  });

  it("deal results have type, id, title, subtitle, url", async () => {
    mockPrisma.gearDeal.findMany.mockResolvedValue([SAMPLE_DEALS[0]]);

    const req = mockRequest("http://localhost/api/search?q=raft");
    const res = await GET(req);
    const data = await res.json();

    const deal = data.deals[0];
    expect(deal.type).toBe("deal");
    expect(deal.id).toBe("d1");
    expect(deal.title).toBe("NRS Raft Sale");
    expect(deal.subtitle).toContain("Rafts");
    expect(deal.subtitle).toContain("$299.99");
    expect(deal.url).toBe("/deals");
  });

  it("trip results have type, id, title, subtitle, url", async () => {
    mockPrisma.trip.findMany.mockResolvedValue(SAMPLE_TRIPS);

    const req = mockRequest("http://localhost/api/search?q=canyon");
    const res = await GET(req);
    const data = await res.json();

    const trip = data.trips[0];
    expect(trip.type).toBe("trip");
    expect(trip.id).toBe("t1");
    expect(trip.title).toBe("Grand Canyon Trip");
    expect(trip.subtitle).toContain("planning");
    expect(trip.url).toBe("/trips/t1");
  });

  it("review results have type, id, title, subtitle, url", async () => {
    mockPrisma.riverReview.findMany.mockResolvedValue([SAMPLE_REVIEWS[0]]);

    const req = mockRequest("http://localhost/api/search?q=amazing");
    const res = await GET(req);
    const data = await res.json();

    const review = data.reviews[0];
    expect(review.type).toBe("review");
    expect(review.id).toBe("rv1");
    expect(review.title).toBe("Amazing rapids");
    expect(review.subtitle).toBe("Colorado River");
    expect(review.url).toBe("/rivers/r1");
  });

  it("review without title uses rating-based title", async () => {
    mockPrisma.riverReview.findMany.mockResolvedValue([SAMPLE_REVIEWS[1]]);

    const req = mockRequest("http://localhost/api/search?q=test");
    const res = await GET(req);
    const data = await res.json();

    expect(data.reviews[0].title).toBe("3-star review");
  });

  it("river subtitle omits difficulty when null", async () => {
    mockPrisma.river.findMany.mockResolvedValue([
      { id: "r3", name: "Test Creek", state: "UT", difficulty: null },
    ]);

    const req = mockRequest("http://localhost/api/search?q=test");
    const res = await GET(req);
    const data = await res.json();

    expect(data.rivers[0].subtitle).toBe("UT");
  });

  it("deal subtitle shows 'Gear' when category is null", async () => {
    mockPrisma.gearDeal.findMany.mockResolvedValue([
      { id: "d3", title: "Some Deal", price: null, category: null },
    ]);

    const req = mockRequest("http://localhost/api/search?q=deal");
    const res = await GET(req);
    const data = await res.json();

    expect(data.deals[0].subtitle).toBe("Gear");
  });

  // ─── Type filter ───────────────────────────────────────

  it("type=rivers returns only rivers, no other queries", async () => {
    mockPrisma.river.findMany.mockResolvedValue(SAMPLE_RIVERS);

    const req = mockRequest("http://localhost/api/search?q=test&type=rivers");
    const res = await GET(req);
    const data = await res.json();

    expect(data.rivers).toHaveLength(2);
    expect(data.deals).toEqual([]);
    expect(data.trips).toEqual([]);
    expect(data.reviews).toEqual([]);
    expect(mockPrisma.gearDeal.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.trip.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.riverReview.findMany).not.toHaveBeenCalled();
  });

  it("type=deals returns only deals", async () => {
    mockPrisma.gearDeal.findMany.mockResolvedValue(SAMPLE_DEALS);

    const req = mockRequest("http://localhost/api/search?q=test&type=deals");
    const res = await GET(req);
    const data = await res.json();

    expect(data.deals).toHaveLength(2);
    expect(data.rivers).toEqual([]);
    expect(data.trips).toEqual([]);
    expect(data.reviews).toEqual([]);
    expect(mockPrisma.river.findMany).not.toHaveBeenCalled();
  });

  it("type=trips requires auth — returns 401 without session", async () => {
    mockAuth.mockResolvedValue(null);

    const req = mockRequest("http://localhost/api/search?q=test&type=trips");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain("Authentication required");
  });

  it("type=trips with auth returns trips", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_ID } });
    mockPrisma.trip.findMany.mockResolvedValue(SAMPLE_TRIPS);

    const req = mockRequest("http://localhost/api/search?q=test&type=trips");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.trips).toHaveLength(1);
    expect(data.rivers).toEqual([]);
    expect(data.deals).toEqual([]);
    expect(data.reviews).toEqual([]);
  });

  it("type=all without auth silently skips trips", async () => {
    mockAuth.mockResolvedValue(null);
    mockPrisma.river.findMany.mockResolvedValue(SAMPLE_RIVERS);
    mockPrisma.gearDeal.findMany.mockResolvedValue(SAMPLE_DEALS);
    mockPrisma.riverReview.findMany.mockResolvedValue(SAMPLE_REVIEWS);

    const req = mockRequest("http://localhost/api/search?q=test&type=all");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.rivers).toHaveLength(2);
    expect(data.deals).toHaveLength(2);
    expect(data.trips).toEqual([]);
    expect(data.reviews).toHaveLength(2);
    expect(mockPrisma.trip.findMany).not.toHaveBeenCalled();
  });

  it("default type is 'all'", async () => {
    mockPrisma.river.findMany.mockResolvedValue(SAMPLE_RIVERS);
    mockPrisma.gearDeal.findMany.mockResolvedValue([]);
    mockPrisma.trip.findMany.mockResolvedValue([]);
    mockPrisma.riverReview.findMany.mockResolvedValue([]);

    const req = mockRequest("http://localhost/api/search?q=test");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    // All Prisma models should be queried
    expect(mockPrisma.river.findMany).toHaveBeenCalled();
    expect(mockPrisma.gearDeal.findMany).toHaveBeenCalled();
    expect(mockPrisma.trip.findMany).toHaveBeenCalled();
    expect(mockPrisma.riverReview.findMany).toHaveBeenCalled();
  });

  it("type=reviews returns only reviews", async () => {
    mockPrisma.riverReview.findMany.mockResolvedValue(SAMPLE_REVIEWS);

    const req = mockRequest("http://localhost/api/search?q=test&type=reviews");
    const res = await GET(req);
    const data = await res.json();

    expect(data.reviews).toHaveLength(2);
    expect(data.rivers).toEqual([]);
    expect(data.deals).toEqual([]);
    expect(data.trips).toEqual([]);
  });

  // ─── Limit param clamping ──────────────────────────────

  it("limit defaults to 10", async () => {
    mockPrisma.river.findMany.mockResolvedValue([]);

    const req = mockRequest("http://localhost/api/search?q=test&type=rivers");
    await GET(req);

    expect(mockPrisma.river.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 })
    );
  });

  it("limit respects custom value", async () => {
    mockPrisma.river.findMany.mockResolvedValue([]);

    const req = mockRequest("http://localhost/api/search?q=test&type=rivers&limit=5");
    await GET(req);

    expect(mockPrisma.river.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 })
    );
  });

  it("limit clamped to max 50", async () => {
    const req = mockRequest("http://localhost/api/search?q=test&limit=100");
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  it("limit clamped to min 1", async () => {
    const req = mockRequest("http://localhost/api/search?q=test&limit=0");
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  it("negative limit returns 400", async () => {
    const req = mockRequest("http://localhost/api/search?q=test&limit=-5");
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  // ─── Case-insensitive search ───────────────────────────

  it("passes insensitive mode to Prisma for rivers", async () => {
    mockPrisma.river.findMany.mockResolvedValue([]);

    const req = mockRequest("http://localhost/api/search?q=COLORADO&type=rivers");
    await GET(req);

    const call = mockPrisma.river.findMany.mock.calls[0][0];
    const orClauses = call.where.OR;
    for (const clause of orClauses) {
      const field = Object.keys(clause)[0];
      expect(clause[field].mode).toBe("insensitive");
    }
  });

  it("passes insensitive mode to Prisma for deals", async () => {
    mockPrisma.gearDeal.findMany.mockResolvedValue([]);

    const req = mockRequest("http://localhost/api/search?q=RAFT&type=deals");
    await GET(req);

    const call = mockPrisma.gearDeal.findMany.mock.calls[0][0];
    const orClauses = call.where.OR;
    for (const clause of orClauses) {
      const field = Object.keys(clause)[0];
      expect(clause[field].mode).toBe("insensitive");
    }
  });

  // ─── No matches ────────────────────────────────────────

  it("returns empty arrays and totalResults=0 when no matches", async () => {
    const req = mockRequest("http://localhost/api/search?q=xyznonexistent");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.rivers).toEqual([]);
    expect(data.deals).toEqual([]);
    expect(data.trips).toEqual([]);
    expect(data.reviews).toEqual([]);
    expect(data.totalResults).toBe(0);
  });

  // ─── Deals filter: isActive ────────────────────────────

  it("deals search filters by isActive: true", async () => {
    mockPrisma.gearDeal.findMany.mockResolvedValue([]);

    const req = mockRequest("http://localhost/api/search?q=test&type=deals");
    await GET(req);

    expect(mockPrisma.gearDeal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    );
  });

  // ─── Trips scoped to user ──────────────────────────────

  it("trips search scoped to authenticated user", async () => {
    mockPrisma.trip.findMany.mockResolvedValue([]);

    const req = mockRequest("http://localhost/api/search?q=test&type=trips");
    await GET(req);

    expect(mockPrisma.trip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: USER_ID }),
      })
    );
  });

  // ─── Ordering ──────────────────────────────────────────

  it("rivers ordered by name ascending", async () => {
    mockPrisma.river.findMany.mockResolvedValue([]);

    const req = mockRequest("http://localhost/api/search?q=test&type=rivers");
    await GET(req);

    expect(mockPrisma.river.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: "asc" } })
    );
  });

  it("deals ordered by scrapedAt descending", async () => {
    mockPrisma.gearDeal.findMany.mockResolvedValue([]);

    const req = mockRequest("http://localhost/api/search?q=test&type=deals");
    await GET(req);

    expect(mockPrisma.gearDeal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { scrapedAt: "desc" } })
    );
  });

  // ─── Error handling ────────────────────────────────────

  it("returns 500 on database error", async () => {
    mockPrisma.river.findMany.mockRejectedValue(new Error("DB down"));

    const req = mockRequest("http://localhost/api/search?q=test");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });

  // ─── Invalid type param ────────────────────────────────

  it("returns 400 for invalid type param", async () => {
    const req = mockRequest("http://localhost/api/search?q=test&type=photos");
    const res = await GET(req);

    expect(res.status).toBe(400);
  });
});
