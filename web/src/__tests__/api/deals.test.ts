/**
 * Tests for the Deals API route handler.
 *
 * Tests:
 * - GET /api/deals (list with filters, pagination)
 * - Edge cases: invalid params, empty results
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  gearDeal: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

import { GET } from "@/app/api/deals/route";

function mockRequest(url: string): Request {
  return new Request(url);
}

describe("GET /api/deals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns deals with total count", async () => {
    const mockDeals = [
      {
        id: "deal-1",
        title: "NRS Otter Raft",
        price: 1200,
        url: "https://craigslist.org/1",
        category: "raft",
        region: "seattle",
        isActive: true,
      },
    ];
    mockPrisma.gearDeal.findMany.mockResolvedValue(mockDeals);
    mockPrisma.gearDeal.count.mockResolvedValue(1);

    const req = mockRequest("http://localhost:3000/api/deals");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.deals).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.limit).toBe(50);
    expect(data.offset).toBe(0);
  });

  it("returns empty result set", async () => {
    mockPrisma.gearDeal.findMany.mockResolvedValue([]);
    mockPrisma.gearDeal.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost:3000/api/deals");
    const res = await GET(req);
    const data = await res.json();

    expect(data.deals).toEqual([]);
    expect(data.total).toBe(0);
  });

  it("filters by category", async () => {
    mockPrisma.gearDeal.findMany.mockResolvedValue([]);
    mockPrisma.gearDeal.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost:3000/api/deals?category=raft");
    await GET(req);

    expect(mockPrisma.gearDeal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: "raft" }),
      })
    );
  });

  it("filters by region", async () => {
    mockPrisma.gearDeal.findMany.mockResolvedValue([]);
    mockPrisma.gearDeal.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost:3000/api/deals?region=seattle");
    await GET(req);

    expect(mockPrisma.gearDeal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ region: "seattle" }),
      })
    );
  });

  it("filters by maxPrice", async () => {
    mockPrisma.gearDeal.findMany.mockResolvedValue([]);
    mockPrisma.gearDeal.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost:3000/api/deals?maxPrice=500");
    await GET(req);

    expect(mockPrisma.gearDeal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ price: { lte: 500 } }),
      })
    );
  });

  it("respects limit parameter", async () => {
    mockPrisma.gearDeal.findMany.mockResolvedValue([]);
    mockPrisma.gearDeal.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost:3000/api/deals?limit=10");
    const res = await GET(req);
    const data = await res.json();

    expect(data.limit).toBe(10);
    expect(mockPrisma.gearDeal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 })
    );
  });

  it("caps limit at 100", async () => {
    mockPrisma.gearDeal.findMany.mockResolvedValue([]);
    mockPrisma.gearDeal.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost:3000/api/deals?limit=999");
    const res = await GET(req);
    const data = await res.json();

    expect(data.limit).toBe(100);
  });

  it("supports offset for pagination", async () => {
    mockPrisma.gearDeal.findMany.mockResolvedValue([]);
    mockPrisma.gearDeal.count.mockResolvedValue(100);

    const req = mockRequest("http://localhost:3000/api/deals?offset=50");
    const res = await GET(req);
    const data = await res.json();

    expect(data.offset).toBe(50);
    expect(mockPrisma.gearDeal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 50 })
    );
  });

  it("only returns active deals", async () => {
    mockPrisma.gearDeal.findMany.mockResolvedValue([]);
    mockPrisma.gearDeal.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost:3000/api/deals");
    await GET(req);

    expect(mockPrisma.gearDeal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    );
  });

  it("combines multiple filters", async () => {
    mockPrisma.gearDeal.findMany.mockResolvedValue([]);
    mockPrisma.gearDeal.count.mockResolvedValue(0);

    const req = mockRequest(
      "http://localhost:3000/api/deals?category=raft&region=seattle&maxPrice=1000"
    );
    await GET(req);

    const callArgs = mockPrisma.gearDeal.findMany.mock.calls[0][0];
    expect(callArgs.where.category).toBe("raft");
    expect(callArgs.where.region).toBe("seattle");
    expect(callArgs.where.price.lte).toBe(1000);
  });
});

// ─── Edge case tests ──────────────────────────────────────

describe("GET /api/deals — edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ignores negative maxPrice (not applied as filter)", async () => {
    mockPrisma.gearDeal.findMany.mockResolvedValue([]);
    mockPrisma.gearDeal.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost:3000/api/deals?maxPrice=-5");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    // Negative price fails the `price > 0` check, so no price filter applied
    const callArgs = mockPrisma.gearDeal.findMany.mock.calls[0][0];
    expect(callArgs.where.price).toBeUndefined();
  });

  it("ignores zero maxPrice (not positive)", async () => {
    mockPrisma.gearDeal.findMany.mockResolvedValue([]);
    mockPrisma.gearDeal.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost:3000/api/deals?maxPrice=0");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const callArgs = mockPrisma.gearDeal.findMany.mock.calls[0][0];
    expect(callArgs.where.price).toBeUndefined();
  });

  it("ignores non-numeric maxPrice", async () => {
    mockPrisma.gearDeal.findMany.mockResolvedValue([]);
    mockPrisma.gearDeal.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost:3000/api/deals?maxPrice=abc");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const callArgs = mockPrisma.gearDeal.findMany.mock.calls[0][0];
    expect(callArgs.where.price).toBeUndefined();
  });

  it("clamps limit=0 to minimum of 1", async () => {
    mockPrisma.gearDeal.findMany.mockResolvedValue([]);
    mockPrisma.gearDeal.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost:3000/api/deals?limit=0");
    const res = await GET(req);
    const data = await res.json();

    expect(data.limit).toBe(1);
    expect(mockPrisma.gearDeal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 })
    );
  });

  it("clamps negative limit to minimum of 1", async () => {
    mockPrisma.gearDeal.findMany.mockResolvedValue([]);
    mockPrisma.gearDeal.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost:3000/api/deals?limit=-10");
    const res = await GET(req);
    const data = await res.json();

    expect(data.limit).toBe(1);
  });

  it("clamps negative offset to 0", async () => {
    mockPrisma.gearDeal.findMany.mockResolvedValue([]);
    mockPrisma.gearDeal.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost:3000/api/deals?offset=-5");
    const res = await GET(req);
    const data = await res.json();

    expect(data.offset).toBe(0);
    expect(mockPrisma.gearDeal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0 })
    );
  });

  it("handles concurrent requests without interference", async () => {
    const deals1 = [
      { id: "d1", title: "Raft A", price: 500, isActive: true },
    ];
    const deals2 = [
      { id: "d2", title: "Kayak B", price: 300, isActive: true },
      { id: "d3", title: "Kayak C", price: 400, isActive: true },
    ];

    // First call returns raft deals, second returns kayak deals
    mockPrisma.gearDeal.findMany
      .mockResolvedValueOnce(deals1)
      .mockResolvedValueOnce(deals2);
    mockPrisma.gearDeal.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);

    const req1 = mockRequest(
      "http://localhost:3000/api/deals?category=raft"
    );
    const req2 = mockRequest(
      "http://localhost:3000/api/deals?category=kayak"
    );

    const [res1, res2] = await Promise.all([GET(req1), GET(req2)]);
    const [data1, data2] = await Promise.all([
      res1.json(),
      res2.json(),
    ]);

    expect(data1.deals).toHaveLength(1);
    expect(data2.deals).toHaveLength(2);
    expect(data1.total).toBe(1);
    expect(data2.total).toBe(2);
  });

  it("handles search with special characters", async () => {
    mockPrisma.gearDeal.findMany.mockResolvedValue([]);
    mockPrisma.gearDeal.count.mockResolvedValue(0);

    const req = mockRequest(
      "http://localhost:3000/api/deals?search=" +
        encodeURIComponent("NRS 14' raft (used)")
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockPrisma.gearDeal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          title: { contains: "NRS 14' raft (used)", mode: "insensitive" },
        }),
      })
    );
  });

  it("handles very large offset beyond total count", async () => {
    mockPrisma.gearDeal.findMany.mockResolvedValue([]);
    mockPrisma.gearDeal.count.mockResolvedValue(10);

    const req = mockRequest(
      "http://localhost:3000/api/deals?offset=999999"
    );
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.deals).toEqual([]);
    expect(data.total).toBe(10);
    expect(data.offset).toBe(999999);
  });

  it("handles extremely large maxPrice", async () => {
    mockPrisma.gearDeal.findMany.mockResolvedValue([]);
    mockPrisma.gearDeal.count.mockResolvedValue(0);

    const req = mockRequest(
      "http://localhost:3000/api/deals?maxPrice=9999999"
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    const callArgs = mockPrisma.gearDeal.findMany.mock.calls[0][0];
    expect(callArgs.where.price.lte).toBe(9999999);
  });

  it("handles deals with null price in response", async () => {
    const dealsWithNullPrice = [
      {
        id: "deal-null-price",
        title: "Free kayak",
        price: null,
        url: "https://craigslist.org/free",
        category: "kayak",
        region: "portland",
        isActive: true,
      },
    ];
    mockPrisma.gearDeal.findMany.mockResolvedValue(dealsWithNullPrice);
    mockPrisma.gearDeal.count.mockResolvedValue(1);

    const req = mockRequest("http://localhost:3000/api/deals");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.deals[0].price).toBeNull();
  });
});
