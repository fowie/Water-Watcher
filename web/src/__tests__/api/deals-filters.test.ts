/**
 * Tests for the Deal Filters API route handler.
 *
 * Tests:
 * - GET /api/deals/filters (requires auth)
 * - POST /api/deals/filters (create with validation)
 * - Edge cases: unauthenticated, invalid filter data
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  dealFilter: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
}));

const mockAuth = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

import { GET, POST } from "@/app/api/deals/filters/route";

function mockRequest(url: string, options: RequestInit = {}): Request {
  return new Request(url, options);
}

describe("GET /api/deals/filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1", email: "test@example.com" } });
  });

  it("returns filters for the authenticated user", async () => {
    const mockFilters = [
      {
        id: "f1",
        name: "Raft deals",
        keywords: ["raft"],
        _count: { matches: 3 },
      },
    ];
    mockPrisma.dealFilter.findMany.mockResolvedValue(mockFilters);

    const req = mockRequest("http://localhost:3000/api/deals/filters");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveLength(1);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const req = mockRequest("http://localhost:3000/api/deals/filters");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Authentication required");
  });

  it("returns empty array when user has no filters", async () => {
    mockPrisma.dealFilter.findMany.mockResolvedValue([]);

    const req = mockRequest("http://localhost:3000/api/deals/filters");
    const res = await GET(req);
    const data = await res.json();

    expect(data).toEqual([]);
  });
});

describe("POST /api/deals/filters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1", email: "test@example.com" } });
  });

  it("creates a filter with valid input", async () => {
    const expected = {
      id: "f-new",
      userId: "user-1",
      name: "PNW Rafts",
      keywords: ["raft", "nrs"],
      categories: ["raft"],
      maxPrice: 2000,
      regions: ["seattle"],
      isActive: true,
    };
    mockPrisma.dealFilter.create.mockResolvedValue(expected);

    const req = mockRequest("http://localhost:3000/api/deals/filters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "PNW Rafts",
        keywords: ["raft", "nrs"],
        categories: ["raft"],
        maxPrice: 2000,
        regions: ["seattle"],
      }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.name).toBe("PNW Rafts");
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const req = mockRequest("http://localhost:3000/api/deals/filters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test",
        keywords: ["raft"],
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Authentication required");
  });

  it("returns 400 for missing filter name", async () => {
    const req = mockRequest("http://localhost:3000/api/deals/filters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keywords: ["raft"],
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid input");
  });

  it("returns 400 for empty keywords", async () => {
    const req = mockRequest("http://localhost:3000/api/deals/filters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Empty filter",
        keywords: [],
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 for negative maxPrice", async () => {
    const req = mockRequest("http://localhost:3000/api/deals/filters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Bad price",
        keywords: ["raft"],
        maxPrice: -100,
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("accepts keywords with special characters", async () => {
    const specialKeywords = ["dry-suit", "roll (combat)", "class III+", "pfd/life-vest"];
    const expected = {
      id: "f-special",
      userId: "user-1",
      name: "Special chars",
      keywords: specialKeywords,
      categories: [],
      regions: [],
      isActive: true,
    };
    mockPrisma.dealFilter.create.mockResolvedValue(expected);

    const req = mockRequest("http://localhost:3000/api/deals/filters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Special chars",
        keywords: specialKeywords,
      }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.keywords).toEqual(specialKeywords);
  });

  it("accepts keywords with unicode and emoji", async () => {
    const unicodeKeywords = ["ラフティング", "🚣 kayak", "río"];
    const expected = {
      id: "f-unicode",
      userId: "user-1",
      name: "Unicode filter",
      keywords: unicodeKeywords,
      categories: [],
      regions: [],
      isActive: true,
    };
    mockPrisma.dealFilter.create.mockResolvedValue(expected);

    const req = mockRequest("http://localhost:3000/api/deals/filters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Unicode filter",
        keywords: unicodeKeywords,
      }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.keywords).toEqual(unicodeKeywords);
  });
});
