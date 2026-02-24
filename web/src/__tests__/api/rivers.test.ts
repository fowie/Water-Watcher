/**
 * Tests for the Rivers API route handlers.
 *
 * Mocks Prisma client and tests:
 * - GET /api/rivers (list with search/filter)
 * - POST /api/rivers (create with validation)
 * - GET /api/rivers/:id (detail with 404)
 * - Edge cases: empty DB, invalid input, missing fields
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma before importing routes — use vi.hoisted so the
// mock object is available when the vi.mock factory runs (hoisted).
const mockPrisma = vi.hoisted(() => ({
  river: {
    findMany: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

import { GET, POST } from "@/app/api/rivers/route";
import { GET as GET_DETAIL } from "@/app/api/rivers/[id]/route";

// Helper to create mock Request objects
function mockRequest(url: string, options: RequestInit = {}): Request {
  return new Request(url, options);
}

describe("GET /api/rivers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns list of rivers", async () => {
    const mockRivers = [
      {
        id: "river-1",
        name: "Colorado River",
        state: "CO",
        conditions: [],
        hazards: [],
        _count: { trackedBy: 5 },
      },
    ];
    mockPrisma.river.findMany.mockResolvedValue(mockRivers);
    mockPrisma.river.count.mockResolvedValue(1);

    const req = mockRequest("http://localhost:3000/api/rivers");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.rivers).toHaveLength(1);
    expect(data.rivers[0].name).toBe("Colorado River");
    expect(data.total).toBe(1);
  });

  it("returns empty array when no rivers exist", async () => {
    mockPrisma.river.findMany.mockResolvedValue([]);
    mockPrisma.river.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost:3000/api/rivers");
    const res = await GET(req);
    const data = await res.json();

    expect(data.rivers).toEqual([]);
    expect(data.total).toBe(0);
  });

  it("filters by state query parameter", async () => {
    mockPrisma.river.findMany.mockResolvedValue([]);
    mockPrisma.river.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost:3000/api/rivers?state=CO");
    await GET(req);

    expect(mockPrisma.river.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ state: "CO" }),
      })
    );
  });

  it("searches by name (case-insensitive)", async () => {
    mockPrisma.river.findMany.mockResolvedValue([]);
    mockPrisma.river.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost:3000/api/rivers?search=salmon");
    await GET(req);

    expect(mockPrisma.river.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: "salmon", mode: "insensitive" },
        }),
      })
    );
  });

  it("combines state and search filters", async () => {
    mockPrisma.river.findMany.mockResolvedValue([]);
    mockPrisma.river.count.mockResolvedValue(0);

    const req = mockRequest(
      "http://localhost:3000/api/rivers?state=ID&search=salmon"
    );
    await GET(req);

    const callArgs = mockPrisma.river.findMany.mock.calls[0][0];
    expect(callArgs.where.state).toBe("ID");
    expect(callArgs.where.name.contains).toBe("salmon");
  });

  it("includes latest condition and hazards", async () => {
    mockPrisma.river.findMany.mockResolvedValue([]);
    mockPrisma.river.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost:3000/api/rivers");
    await GET(req);

    const callArgs = mockPrisma.river.findMany.mock.calls[0][0];
    expect(callArgs.include.conditions.take).toBe(1);
    expect(callArgs.include.hazards.take).toBe(3);
  });
});

describe("POST /api/rivers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a river with valid input", async () => {
    const newRiver = {
      id: "river-new",
      name: "Gauley River",
      state: "WV",
      createdAt: new Date().toISOString(),
    };
    mockPrisma.river.create.mockResolvedValue(newRiver);

    const req = mockRequest("http://localhost:3000/api/rivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Gauley River", state: "WV" }),
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.name).toBe("Gauley River");
  });

  it("returns 400 for missing required fields", async () => {
    const req = mockRequest("http://localhost:3000/api/rivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "No State River" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid input");
  });

  it("returns 400 for empty name", async () => {
    const req = mockRequest("http://localhost:3000/api/rivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", state: "CO" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid latitude", async () => {
    const req = mockRequest("http://localhost:3000/api/rivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test River",
        state: "CO",
        latitude: 999,
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("accepts unicode in river name", async () => {
    const body = { name: "Río Grande — Taos Box", state: "NM" };
    mockPrisma.river.create.mockResolvedValue({ id: "r1", ...body });

    const req = mockRequest("http://localhost:3000/api/rivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
  });
});

describe("GET /api/rivers/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns river detail when found", async () => {
    const mockRiver = {
      id: "river-1",
      name: "Colorado River",
      state: "CO",
      conditions: [],
      hazards: [],
      campsites: [],
      rapids: [],
      _count: { trackedBy: 3 },
    };
    mockPrisma.river.findUnique.mockResolvedValue(mockRiver);

    const req = mockRequest("http://localhost:3000/api/rivers/river-1");
    const res = await GET_DETAIL(req, {
      params: Promise.resolve({ id: "river-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.name).toBe("Colorado River");
  });

  it("returns 404 when river not found", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(null);

    const req = mockRequest("http://localhost:3000/api/rivers/nonexistent");
    const res = await GET_DETAIL(req, {
      params: Promise.resolve({ id: "nonexistent" }),
    });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("River not found");
  });

  it("returns 404 for random UUID", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(null);

    const req = mockRequest(
      "http://localhost:3000/api/rivers/abc-def-123-456"
    );
    const res = await GET_DETAIL(req, {
      params: Promise.resolve({ id: "abc-def-123-456" }),
    });

    expect(res.status).toBe(404);
  });
});
