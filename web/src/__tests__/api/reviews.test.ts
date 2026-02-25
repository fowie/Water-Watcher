/**
 * Tests for the River Reviews API.
 *
 * Routes:
 *   GET  /api/rivers/:id/reviews — paginated list (public, no auth)
 *   POST /api/rivers/:id/reviews — create/upsert review (auth + rate limit)
 *
 * Coverage:
 * - Paginated GET with averageRating
 * - Default ordering (createdAt desc)
 * - POST creates new review (upsert)
 * - POST upserts when user already has a review
 * - POST validation: rating 1-5, body required
 * - 404 for non-existent river
 * - Empty reviews returns empty array and null average
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  river: {
    findUnique: vi.fn(),
  },
  riverReview: {
    findMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    upsert: vi.fn(),
  },
}));

const mockAuth = vi.hoisted(() => vi.fn());
const mockRateLimit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
  defaultConfig: { maxTokens: 60, refillRate: 1, refillInterval: 1 },
  reviewConfig: { maxTokens: 10, refillRate: 10 / 60, refillInterval: 1 },
  resetRateLimiter: vi.fn(),
}));

import { GET, POST } from "@/app/api/rivers/[id]/reviews/route";

function mockRequest(url: string, options: RequestInit = {}): Request {
  return new Request(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
}

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

const USER_ID = "user-1";
const RIVER_ID = "river-1";

const SAMPLE_RIVER = {
  id: RIVER_ID,
  name: "Colorado River",
  state: "CO",
};

const SAMPLE_REVIEWS = [
  {
    id: "review-1",
    riverId: RIVER_ID,
    userId: "user-1",
    rating: 5,
    title: "Amazing run!",
    body: "Best whitewater in Colorado",
    visitDate: null,
    difficulty: "III",
    createdAt: "2026-02-24T10:00:00.000Z",
    updatedAt: "2026-02-24T10:00:00.000Z",
    user: { id: "user-1", name: "Alice", image: null },
  },
  {
    id: "review-2",
    riverId: RIVER_ID,
    userId: "user-2",
    rating: 3,
    title: "Decent",
    body: "A bit crowded but fun",
    visitDate: null,
    difficulty: "III",
    createdAt: "2026-02-23T10:00:00.000Z",
    updatedAt: "2026-02-23T10:00:00.000Z",
    user: { id: "user-2", name: "Bob", image: null },
  },
];

describe("GET /api/rivers/:id/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // GET is public, no auth needed
  });

  it("returns paginated list of reviews", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverReview.findMany.mockResolvedValue(SAMPLE_REVIEWS);
    mockPrisma.riverReview.count.mockResolvedValue(2);
    mockPrisma.riverReview.aggregate.mockResolvedValue({
      _avg: { rating: 4.0 },
    });
    const req = mockRequest(
      "http://localhost:3000/api/rivers/river-1/reviews"
    );
    const res = await GET(req, makeContext(RIVER_ID));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.reviews).toHaveLength(2);
    expect(data.total).toBe(2);
    expect(data.limit).toBe(20);
    expect(data.offset).toBe(0);
  });

  it("includes average rating in response", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverReview.findMany.mockResolvedValue(SAMPLE_REVIEWS);
    mockPrisma.riverReview.count.mockResolvedValue(2);
    mockPrisma.riverReview.aggregate.mockResolvedValue({
      _avg: { rating: 4.0 },
    });
    const req = mockRequest(
      "http://localhost:3000/api/rivers/river-1/reviews"
    );
    const res = await GET(req, makeContext(RIVER_ID));
    const data = await res.json();
    expect(data.averageRating).toBe(4.0);
  });

  it("orders reviews by createdAt desc by default", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverReview.findMany.mockResolvedValue([]);
    mockPrisma.riverReview.count.mockResolvedValue(0);
    mockPrisma.riverReview.aggregate.mockResolvedValue({
      _avg: { rating: null },
    });
    const req = mockRequest(
      "http://localhost:3000/api/rivers/river-1/reviews"
    );
    await GET(req, makeContext(RIVER_ID));
    expect(mockPrisma.riverReview.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      })
    );
  });

  it("returns empty array and null average with no reviews", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverReview.findMany.mockResolvedValue([]);
    mockPrisma.riverReview.count.mockResolvedValue(0);
    mockPrisma.riverReview.aggregate.mockResolvedValue({
      _avg: { rating: null },
    });
    const req = mockRequest(
      "http://localhost:3000/api/rivers/river-1/reviews"
    );
    const res = await GET(req, makeContext(RIVER_ID));
    const data = await res.json();
    expect(data.reviews).toEqual([]);
    expect(data.total).toBe(0);
    expect(data.averageRating).toBeNull();
  });

  it("returns 404 for non-existent river", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(null);
    const req = mockRequest(
      "http://localhost:3000/api/rivers/nonexistent/reviews"
    );
    const res = await GET(req, makeContext("nonexistent"));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("River not found");
  });

  it("respects custom limit and offset params", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverReview.findMany.mockResolvedValue([SAMPLE_REVIEWS[0]]);
    mockPrisma.riverReview.count.mockResolvedValue(2);
    mockPrisma.riverReview.aggregate.mockResolvedValue({
      _avg: { rating: 4.0 },
    });
    const req = mockRequest(
      "http://localhost:3000/api/rivers/river-1/reviews?limit=1&offset=1"
    );
    const res = await GET(req, makeContext(RIVER_ID));
    const data = await res.json();
    expect(data.limit).toBe(1);
    expect(data.offset).toBe(1);
    expect(mockPrisma.riverReview.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 1,
        skip: 1,
      })
    );
  });

  it("clamps limit to [1, 100] range", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverReview.findMany.mockResolvedValue([]);
    mockPrisma.riverReview.count.mockResolvedValue(0);
    mockPrisma.riverReview.aggregate.mockResolvedValue({
      _avg: { rating: null },
    });
    const req = mockRequest(
      "http://localhost:3000/api/rivers/river-1/reviews?limit=200"
    );
    const res = await GET(req, makeContext(RIVER_ID));
    const data = await res.json();
    expect(data.limit).toBe(100);
  });

  it("clamps negative limit to 1", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverReview.findMany.mockResolvedValue([]);
    mockPrisma.riverReview.count.mockResolvedValue(0);
    mockPrisma.riverReview.aggregate.mockResolvedValue({
      _avg: { rating: null },
    });
    const req = mockRequest(
      "http://localhost:3000/api/rivers/river-1/reviews?limit=-5"
    );
    const res = await GET(req, makeContext(RIVER_ID));
    const data = await res.json();
    expect(data.limit).toBe(1);
  });

  it("clamps negative offset to 0", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverReview.findMany.mockResolvedValue([]);
    mockPrisma.riverReview.count.mockResolvedValue(0);
    mockPrisma.riverReview.aggregate.mockResolvedValue({
      _avg: { rating: null },
    });
    const req = mockRequest(
      "http://localhost:3000/api/rivers/river-1/reviews?offset=-10"
    );
    const res = await GET(req, makeContext(RIVER_ID));
    const data = await res.json();
    expect(data.offset).toBe(0);
  });

  it("includes user info in each review", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverReview.findMany.mockResolvedValue(SAMPLE_REVIEWS);
    mockPrisma.riverReview.count.mockResolvedValue(2);
    mockPrisma.riverReview.aggregate.mockResolvedValue({
      _avg: { rating: 4.0 },
    });
    const req = mockRequest(
      "http://localhost:3000/api/rivers/river-1/reviews"
    );
    await GET(req, makeContext(RIVER_ID));
    expect(mockPrisma.riverReview.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          user: expect.objectContaining({
            select: expect.objectContaining({ name: true, image: true }),
          }),
        }),
      })
    );
  });
});

describe("POST /api/rivers/:id/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: USER_ID, email: "test@example.com" } });
    // Allow rate limiting to pass by default
    mockRateLimit.mockReturnValue({
      success: true,
      remaining: 9,
      reset: Math.ceil(Date.now() / 1000) + 60,
    });
  });

  it("creates a new review", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverReview.upsert.mockResolvedValue({
      ...SAMPLE_REVIEWS[0],
      userId: USER_ID,
    });
    const req = mockRequest(
      "http://localhost:3000/api/rivers/river-1/reviews",
      {
        method: "POST",
        body: JSON.stringify({
          rating: 5,
          body: "Best whitewater in Colorado",
          title: "Amazing run!",
        }),
      }
    );
    const res = await POST(req, makeContext(RIVER_ID));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.rating).toBe(5);
  });

  it("upserts when user already has a review for that river", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverReview.upsert.mockResolvedValue({
      ...SAMPLE_REVIEWS[0],
      body: "Updated review text",
    });
    const req = mockRequest(
      "http://localhost:3000/api/rivers/river-1/reviews",
      {
        method: "POST",
        body: JSON.stringify({
          rating: 4,
          body: "Updated review text",
        }),
      }
    );
    const res = await POST(req, makeContext(RIVER_ID));
    expect(res.status).toBe(201);
    expect(mockPrisma.riverReview.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          riverId_userId: { riverId: RIVER_ID, userId: USER_ID },
        },
        create: expect.objectContaining({
          riverId: RIVER_ID,
          userId: USER_ID,
        }),
        update: expect.objectContaining({
          rating: 4,
          body: "Updated review text",
        }),
      })
    );
  });

  it("returns 400 when rating is below 1", async () => {
    const req = mockRequest(
      "http://localhost:3000/api/rivers/river-1/reviews",
      {
        method: "POST",
        body: JSON.stringify({ rating: 0, body: "Too low" }),
      }
    );
    const res = await POST(req, makeContext(RIVER_ID));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid input");
  });

  it("returns 400 when rating is above 5", async () => {
    const req = mockRequest(
      "http://localhost:3000/api/rivers/river-1/reviews",
      {
        method: "POST",
        body: JSON.stringify({ rating: 6, body: "Too high" }),
      }
    );
    const res = await POST(req, makeContext(RIVER_ID));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is missing", async () => {
    const req = mockRequest(
      "http://localhost:3000/api/rivers/river-1/reviews",
      {
        method: "POST",
        body: JSON.stringify({ rating: 3 }),
      }
    );
    const res = await POST(req, makeContext(RIVER_ID));
    expect(res.status).toBe(400);
  });

  it("returns 400 when body is empty string", async () => {
    const req = mockRequest(
      "http://localhost:3000/api/rivers/river-1/reviews",
      {
        method: "POST",
        body: JSON.stringify({ rating: 3, body: "" }),
      }
    );
    const res = await POST(req, makeContext(RIVER_ID));
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent river", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(null);
    const req = mockRequest(
      "http://localhost:3000/api/rivers/nonexistent/reviews",
      {
        method: "POST",
        body: JSON.stringify({ rating: 4, body: "Good" }),
      }
    );
    const res = await POST(req, makeContext("nonexistent"));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("River not found");
  });

  it("returns 401 without authentication", async () => {
    mockAuth.mockResolvedValue(null);
    const req = mockRequest(
      "http://localhost:3000/api/rivers/river-1/reviews",
      {
        method: "POST",
        body: JSON.stringify({ rating: 4, body: "Good" }),
      }
    );
    const res = await POST(req, makeContext(RIVER_ID));
    expect(res.status).toBe(401);
  });

  it("accepts optional visitDate and difficulty", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverReview.upsert.mockResolvedValue({
      ...SAMPLE_REVIEWS[0],
      visitDate: "2026-06-01T00:00:00.000Z",
      difficulty: "IV",
    });
    const req = mockRequest(
      "http://localhost:3000/api/rivers/river-1/reviews",
      {
        method: "POST",
        body: JSON.stringify({
          rating: 5,
          body: "Challenging but fun",
          visitDate: "2026-06-01T00:00:00.000Z",
          difficulty: "IV",
        }),
      }
    );
    const res = await POST(req, makeContext(RIVER_ID));
    expect(res.status).toBe(201);
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockReturnValue({
      success: false,
      remaining: 0,
      reset: Math.ceil(Date.now() / 1000) + 30,
    });
    const req = mockRequest(
      "http://localhost:3000/api/rivers/river-1/reviews",
      {
        method: "POST",
        body: JSON.stringify({ rating: 4, body: "Spamming" }),
      }
    );
    const res = await POST(req, makeContext(RIVER_ID));
    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toContain("Too many requests");
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns 400 when rating is not an integer", async () => {
    const req = mockRequest(
      "http://localhost:3000/api/rivers/river-1/reviews",
      {
        method: "POST",
        body: JSON.stringify({ rating: 3.5, body: "Decimal rating" }),
      }
    );
    const res = await POST(req, makeContext(RIVER_ID));
    expect(res.status).toBe(400);
  });
});
