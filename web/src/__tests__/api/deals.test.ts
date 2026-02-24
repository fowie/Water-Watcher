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
