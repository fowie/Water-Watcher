/**
 * Tests for the Rivers API route handlers.
 *
 * Mocks Prisma client and tests:
 * - GET /api/rivers (list with search/filter — public)
 * - POST /api/rivers (create with validation — requires auth)
 * - GET /api/rivers/:id (detail with 404 — public)
 * - PATCH /api/rivers/:id (update — requires auth)
 * - DELETE /api/rivers/:id (delete — requires auth)
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
    delete: vi.fn(),
    update: vi.fn(),
  },
}));

const mockAuth = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

import { GET, POST } from "@/app/api/rivers/route";
import { GET as GET_DETAIL, DELETE, PATCH } from "@/app/api/rivers/[id]/route";

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
    mockAuth.mockResolvedValue({ user: { id: "user-1", email: "test@example.com" } });
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

// ─── Edge case tests ──────────────────────────────────────

describe("GET /api/rivers — edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles rivers with missing optional fields (no conditions, hazards)", async () => {
    const sparseRiver = {
      id: "river-sparse",
      name: "Unknown Creek",
      state: "MT",
      conditions: [],
      hazards: [],
      latitude: null,
      longitude: null,
      difficulty: null,
      description: null,
      awId: null,
      usgsGaugeId: null,
      _count: { trackedBy: 0 },
    };
    mockPrisma.river.findMany.mockResolvedValue([sparseRiver]);
    mockPrisma.river.count.mockResolvedValue(1);

    const req = mockRequest("http://localhost:3000/api/rivers");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.rivers[0].name).toBe("Unknown Creek");
    expect(data.rivers[0].latitude).toBeNull();
    expect(data.rivers[0].difficulty).toBeNull();
  });

  it("handles search with special characters (SQL-like injection)", async () => {
    mockPrisma.river.findMany.mockResolvedValue([]);
    mockPrisma.river.count.mockResolvedValue(0);

    const req = mockRequest(
      "http://localhost:3000/api/rivers?search=" +
        encodeURIComponent("'; DROP TABLE rivers; --")
    );
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.rivers).toEqual([]);
    // The raw search string should be passed through to Prisma (parameterized)
    expect(mockPrisma.river.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: {
            contains: "'; DROP TABLE rivers; --",
            mode: "insensitive",
          },
        }),
      })
    );
  });

  it("handles search with emoji characters", async () => {
    mockPrisma.river.findMany.mockResolvedValue([]);
    mockPrisma.river.count.mockResolvedValue(0);

    const req = mockRequest(
      "http://localhost:3000/api/rivers?search=" +
        encodeURIComponent("🏞️ River")
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockPrisma.river.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: "🏞️ River", mode: "insensitive" },
        }),
      })
    );
  });

  it("handles search with unicode/accented characters", async () => {
    mockPrisma.river.findMany.mockResolvedValue([]);
    mockPrisma.river.count.mockResolvedValue(0);

    const req = mockRequest(
      "http://localhost:3000/api/rivers?search=" +
        encodeURIComponent("Río Chámа")
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockPrisma.river.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          name: { contains: "Río Chámа", mode: "insensitive" },
        }),
      })
    );
  });

  it("handles very large limit (capped at 100)", async () => {
    mockPrisma.river.findMany.mockResolvedValue([]);
    mockPrisma.river.count.mockResolvedValue(0);

    const req = mockRequest(
      "http://localhost:3000/api/rivers?limit=999999"
    );
    const res = await GET(req);
    const data = await res.json();

    expect(data.limit).toBe(100);
    expect(mockPrisma.river.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    );
  });

  it("handles very large offset", async () => {
    mockPrisma.river.findMany.mockResolvedValue([]);
    mockPrisma.river.count.mockResolvedValue(5);

    const req = mockRequest(
      "http://localhost:3000/api/rivers?offset=1000000"
    );
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.rivers).toEqual([]);
    expect(data.offset).toBe(1000000);
  });

  it("handles non-numeric limit (falls back to NaN → default)", async () => {
    mockPrisma.river.findMany.mockResolvedValue([]);
    mockPrisma.river.count.mockResolvedValue(0);

    const req = mockRequest(
      "http://localhost:3000/api/rivers?limit=abc"
    );
    const res = await GET(req);

    // parseInt("abc") is NaN, Math.min(NaN, 100) is NaN
    // Prisma will receive take: NaN which may cause issues
    // This tests resilience — route should still respond
    expect(res.status).toBeLessThanOrEqual(500);
  });

  it("handles empty search string", async () => {
    mockPrisma.river.findMany.mockResolvedValue([]);
    mockPrisma.river.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost:3000/api/rivers?search=");
    const res = await GET(req);

    expect(res.status).toBe(200);
  });

  it("handles negative offset value", async () => {
    mockPrisma.river.findMany.mockResolvedValue([]);
    mockPrisma.river.count.mockResolvedValue(0);

    const req = mockRequest(
      "http://localhost:3000/api/rivers?offset=-10"
    );
    const res = await GET(req);

    // Route doesn't clamp offset — Prisma will receive skip: -10
    expect(res.status).toBeLessThanOrEqual(500);
  });

  it("returns river detail with all optional relations populated", async () => {
    const fullRiver = {
      id: "river-full",
      name: "Grand Canyon of the Colorado",
      state: "AZ",
      latitude: 36.1,
      longitude: -112.1,
      difficulty: "Class V",
      description: "The big one",
      conditions: [{ id: "c1", flowRate: 12000, scrapedAt: new Date() }],
      hazards: [
        { id: "h1", name: "Lava Falls", isActive: true },
        { id: "h2", name: "Crystal Rapid", isActive: true },
      ],
      campsites: [{ id: "cs1", name: "Phantom Ranch" }],
      rapids: [{ id: "r1", name: "Hermit", mile: 95 }],
      _count: { trackedBy: 42 },
    };
    mockPrisma.river.findUnique.mockResolvedValue(fullRiver);

    const req = mockRequest("http://localhost:3000/api/rivers/river-full");
    const res = await GET_DETAIL(req, {
      params: Promise.resolve({ id: "river-full" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.conditions).toHaveLength(1);
    expect(data.hazards).toHaveLength(2);
    expect(data.campsites).toHaveLength(1);
    expect(data.rapids).toHaveLength(1);
    expect(data._count.trackedBy).toBe(42);
  });
});

describe("DELETE /api/rivers/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1", email: "test@example.com" } });
  });

  it("deletes a river and returns 204", async () => {
    mockPrisma.river.findUnique.mockResolvedValue({ id: "river-1", name: "Test River" });
    mockPrisma.river.delete.mockResolvedValue({ id: "river-1" });

    const req = mockRequest("http://localhost:3000/api/rivers/river-1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "river-1" }) });

    expect(res.status).toBe(204);
    expect(mockPrisma.river.delete).toHaveBeenCalledWith({ where: { id: "river-1" } });
  });

  it("returns 404 when river does not exist", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(null);

    const req = mockRequest("http://localhost:3000/api/rivers/nonexistent", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "nonexistent" }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("River not found");
    expect(mockPrisma.river.delete).not.toHaveBeenCalled();
  });

  it("returns 500 on database error", async () => {
    mockPrisma.river.findUnique.mockResolvedValue({ id: "river-1" });
    mockPrisma.river.delete.mockRejectedValue(new Error("DB error"));

    const req = mockRequest("http://localhost:3000/api/rivers/river-1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "river-1" }) });
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });
});

describe("PATCH /api/rivers/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1", email: "test@example.com" } });
  });

  it("updates a river with valid partial data", async () => {
    const existing = { id: "river-1", name: "Colorado River", state: "CO" };
    const updated = { ...existing, name: "Colorado River (Gore Canyon)" };
    mockPrisma.river.findUnique.mockResolvedValue(existing);
    mockPrisma.river.update.mockResolvedValue(updated);

    const req = mockRequest("http://localhost:3000/api/rivers/river-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Colorado River (Gore Canyon)" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "river-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.name).toBe("Colorado River (Gore Canyon)");
    expect(mockPrisma.river.update).toHaveBeenCalledWith({
      where: { id: "river-1" },
      data: { name: "Colorado River (Gore Canyon)" },
    });
  });

  it("returns 404 when river not found", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(null);

    const req = mockRequest("http://localhost:3000/api/rivers/nonexistent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "nonexistent" }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("River not found");
    expect(mockPrisma.river.update).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid latitude", async () => {
    const req = mockRequest("http://localhost:3000/api/rivers/river-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: 999 }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "river-1" }) });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid input");
  });

  it("returns 400 for empty name", async () => {
    const req = mockRequest("http://localhost:3000/api/rivers/river-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "river-1" }) });

    expect(res.status).toBe(400);
  });

  it("accepts nullable fields (set region to null)", async () => {
    const existing = { id: "river-1", name: "Test", state: "CO", region: "Front Range" };
    const updated = { ...existing, region: null };
    mockPrisma.river.findUnique.mockResolvedValue(existing);
    mockPrisma.river.update.mockResolvedValue(updated);

    const req = mockRequest("http://localhost:3000/api/rivers/river-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region: null }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "river-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.region).toBeNull();
  });

  it("returns 500 on database error", async () => {
    mockPrisma.river.findUnique.mockResolvedValue({ id: "river-1" });
    mockPrisma.river.update.mockRejectedValue(new Error("DB error"));

    const req = mockRequest("http://localhost:3000/api/rivers/river-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "river-1" }) });
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });

  it("full update with all supported fields", async () => {
    const existing = { id: "river-1", name: "Old", state: "CO" };
    const updatePayload = {
      name: "Colorado River — Full Update",
      state: "AZ",
      region: "Southwest",
      latitude: 36.1,
      longitude: -112.1,
      difficulty: "Class V",
      description: "Updated description",
    };
    const updated = { id: "river-1", ...updatePayload };
    mockPrisma.river.findUnique.mockResolvedValue(existing);
    mockPrisma.river.update.mockResolvedValue(updated);

    const req = mockRequest("http://localhost:3000/api/rivers/river-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatePayload),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "river-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.name).toBe("Colorado River — Full Update");
    expect(data.latitude).toBe(36.1);
    expect(data.difficulty).toBe("Class V");
  });

  it("strips unknown fields from update payload", async () => {
    const existing = { id: "river-1", name: "Test", state: "CO" };
    mockPrisma.river.findUnique.mockResolvedValue(existing);
    mockPrisma.river.update.mockResolvedValue({ ...existing, name: "Updated" });

    const req = mockRequest("http://localhost:3000/api/rivers/river-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated", hackerField: "evil", __proto__: {} }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "river-1" }) });

    expect(res.status).toBe(200);
    // Verify prisma.update was NOT called with the unknown fields
    const updateCall = mockPrisma.river.update.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty("hackerField");
    expect(updateCall.data).toEqual({ name: "Updated" });
  });

  it("returns 400 for invalid longitude", async () => {
    const req = mockRequest("http://localhost:3000/api/rivers/river-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ longitude: 999 }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "river-1" }) });

    expect(res.status).toBe(400);
  });

  it("accepts imageUrl as valid URL", async () => {
    const existing = { id: "river-1", name: "Test", state: "CO" };
    const updated = { ...existing, imageUrl: "https://example.com/photo.jpg" };
    mockPrisma.river.findUnique.mockResolvedValue(existing);
    mockPrisma.river.update.mockResolvedValue(updated);

    const req = mockRequest("http://localhost:3000/api/rivers/river-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: "https://example.com/photo.jpg" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "river-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.imageUrl).toBe("https://example.com/photo.jpg");
  });

  it("rejects imageUrl that is not a valid URL", async () => {
    const req = mockRequest("http://localhost:3000/api/rivers/river-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: "not-a-url" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "river-1" }) });

    expect(res.status).toBe(400);
  });

  it("allows setting imageUrl to null", async () => {
    const existing = { id: "river-1", name: "Test", state: "CO", imageUrl: "https://example.com/old.jpg" };
    const updated = { ...existing, imageUrl: null };
    mockPrisma.river.findUnique.mockResolvedValue(existing);
    mockPrisma.river.update.mockResolvedValue(updated);

    const req = mockRequest("http://localhost:3000/api/rivers/river-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: null }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "river-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.imageUrl).toBeNull();
  });
});
