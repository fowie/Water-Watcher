/**
 * Tests for the User Rivers (favorites/tracking) API route handler.
 * Endpoints: GET/POST/DELETE /api/user/rivers
 *
 * Mocks Prisma client and auth middleware, then tests:
 * - GET lists user's tracked rivers with latest conditions
 * - POST adds a river to tracking (201)
 * - POST duplicate river returns 409
 * - POST non-existent river returns 404
 * - POST missing riverId returns 400
 * - DELETE removes river from tracking (204)
 * - DELETE non-tracked river returns 404
 * - DELETE missing riverId returns 400
 * - All require authentication (401 without session)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  userRiver: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  river: {
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

vi.mock("@/lib/api-errors", async () => {
  const { NextResponse } = await import("next/server");
  return {
    apiError: (status: number, message: string) =>
      NextResponse.json({ error: message }, { status }),
    handleApiError: (error: unknown) => {
      console.error("API error:", error);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    },
  };
});

import { GET, POST, DELETE } from "@/app/api/user/rivers/route";

function mockGetRequest(): Request {
  return new Request("http://localhost/api/user/rivers", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
}

function mockPostRequest(body: unknown): Request {
  return new Request("http://localhost/api/user/rivers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockDeleteRequest(riverId?: string): Request {
  const url = riverId
    ? `http://localhost/api/user/rivers?riverId=${riverId}`
    : "http://localhost/api/user/rivers";
  return new Request(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
}

const MOCK_TRACKED_RIVERS = [
  {
    id: "ur-1",
    userId: "user-1",
    riverId: "river-1",
    createdAt: new Date("2026-02-01T00:00:00Z"),
    river: {
      id: "river-1",
      name: "Colorado River",
      state: "CO",
      difficulty: "Class III-IV",
      conditions: [
        {
          quality: "good",
          flowRate: 12400,
          runnability: "runnable",
          scrapedAt: new Date("2026-02-24T10:00:00Z"),
        },
      ],
      hazards: [
        { id: "h1", isActive: true, type: "strainer" },
      ],
      _count: { trackedBy: 42 },
    },
  },
  {
    id: "ur-2",
    userId: "user-1",
    riverId: "river-2",
    createdAt: new Date("2026-02-10T00:00:00Z"),
    river: {
      id: "river-2",
      name: "Salmon River",
      state: "ID",
      difficulty: "Class IV",
      conditions: [],
      hazards: [],
      _count: { trackedBy: 15 },
    },
  },
];

// ─── GET /api/user/rivers ──────────────────────────────────

describe("GET /api/user/rivers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without authentication", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await GET(mockGetRequest());
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain("Authentication required");
  });

  it("returns tracked rivers with conditions", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.userRiver.findMany.mockResolvedValue(MOCK_TRACKED_RIVERS);

    const res = await GET(mockGetRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.rivers).toHaveLength(2);
    expect(data.rivers[0].name).toBe("Colorado River");
    expect(data.rivers[0].latestCondition).toBeDefined();
    expect(data.rivers[0].latestCondition.quality).toBe("good");
    expect(data.rivers[0].latestCondition.flowRate).toBe(12400);
  });

  it("returns null latestCondition when no conditions exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.userRiver.findMany.mockResolvedValue(MOCK_TRACKED_RIVERS);

    const res = await GET(mockGetRequest());
    const data = await res.json();

    const salmonRiver = data.rivers.find(
      (r: { name: string }) => r.name === "Salmon River"
    );
    expect(salmonRiver.latestCondition).toBeNull();
  });

  it("includes active hazard count", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.userRiver.findMany.mockResolvedValue(MOCK_TRACKED_RIVERS);

    const res = await GET(mockGetRequest());
    const data = await res.json();

    expect(data.rivers[0].activeHazardCount).toBe(1);
    expect(data.rivers[1].activeHazardCount).toBe(0);
  });

  it("includes tracker count", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.userRiver.findMany.mockResolvedValue(MOCK_TRACKED_RIVERS);

    const res = await GET(mockGetRequest());
    const data = await res.json();

    expect(data.rivers[0].trackerCount).toBe(42);
  });

  it("includes trackedAt date", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.userRiver.findMany.mockResolvedValue(MOCK_TRACKED_RIVERS);

    const res = await GET(mockGetRequest());
    const data = await res.json();

    expect(data.rivers[0].trackedAt).toBeDefined();
  });

  it("returns empty rivers array when none tracked", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.userRiver.findMany.mockResolvedValue([]);

    const res = await GET(mockGetRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.rivers).toHaveLength(0);
  });

  it("returns 500 on database error", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.userRiver.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET(mockGetRequest());
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toContain("Internal server error");
  });
});

// ─── POST /api/user/rivers ─────────────────────────────────

describe("POST /api/user/rivers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without authentication", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await POST(mockPostRequest({ riverId: "river-1" }));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain("Authentication required");
  });

  it("adds a river to tracking and returns 201", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.river.findUnique.mockResolvedValue({ id: "river-1" });
    mockPrisma.userRiver.findUnique.mockResolvedValue(null);
    mockPrisma.userRiver.create.mockResolvedValue({
      id: "ur-new",
      userId: "user-1",
      riverId: "river-1",
    });

    const res = await POST(mockPostRequest({ riverId: "river-1" }));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.riverId).toBe("river-1");
  });

  it("returns 404 when river does not exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.river.findUnique.mockResolvedValue(null);

    const res = await POST(mockPostRequest({ riverId: "nonexistent" }));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain("not found");
  });

  it("returns 409 when river is already tracked", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.river.findUnique.mockResolvedValue({ id: "river-1" });
    mockPrisma.userRiver.findUnique.mockResolvedValue({
      id: "ur-existing",
      userId: "user-1",
      riverId: "river-1",
    });

    const res = await POST(mockPostRequest({ riverId: "river-1" }));
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toContain("already tracked");
  });

  it("returns 400 when riverId is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const res = await POST(mockPostRequest({}));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("riverId");
  });

  it("returns 400 when riverId is not a string", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const res = await POST(mockPostRequest({ riverId: 123 }));
    const data = await res.json();

    expect(res.status).toBe(400);
  });

  it("returns 400 when riverId is empty string", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const res = await POST(mockPostRequest({ riverId: "" }));
    const data = await res.json();

    expect(res.status).toBe(400);
  });

  it("returns 500 on database error", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.river.findUnique.mockResolvedValue({ id: "river-1" });
    mockPrisma.userRiver.findUnique.mockResolvedValue(null);
    mockPrisma.userRiver.create.mockRejectedValue(new Error("DB error"));

    const res = await POST(mockPostRequest({ riverId: "river-1" }));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toContain("Internal server error");
  });

  it("checks river existence before duplicate check", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.river.findUnique.mockResolvedValue(null);

    const res = await POST(mockPostRequest({ riverId: "nonexistent" }));

    // Should return 404 because river.findUnique is null,
    // not proceed to check userRiver.findUnique
    expect(res.status).toBe(404);
    expect(mockPrisma.userRiver.findUnique).not.toHaveBeenCalled();
  });
});

// ─── DELETE /api/user/rivers ───────────────────────────────

describe("DELETE /api/user/rivers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without authentication", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await DELETE(mockDeleteRequest("river-1"));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain("Authentication required");
  });

  it("removes a tracked river and returns 204", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.userRiver.findUnique.mockResolvedValue({
      id: "ur-1",
      userId: "user-1",
      riverId: "river-1",
    });
    mockPrisma.userRiver.delete.mockResolvedValue({});

    const res = await DELETE(mockDeleteRequest("river-1"));

    expect(res.status).toBe(204);
  });

  it("returns 404 when river is not tracked", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.userRiver.findUnique.mockResolvedValue(null);

    const res = await DELETE(mockDeleteRequest("not-tracked"));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain("not tracked");
  });

  it("returns 400 when riverId query param is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const res = await DELETE(mockDeleteRequest());
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("riverId");
  });

  it("returns 500 on database error during delete", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.userRiver.findUnique.mockResolvedValue({
      id: "ur-1",
      userId: "user-1",
      riverId: "river-1",
    });
    mockPrisma.userRiver.delete.mockRejectedValue(new Error("DB error"));

    const res = await DELETE(mockDeleteRequest("river-1"));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toContain("Internal server error");
  });

  it("calls delete with correct composite key", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.userRiver.findUnique.mockResolvedValue({
      id: "ur-1",
      userId: "user-1",
      riverId: "river-1",
    });
    mockPrisma.userRiver.delete.mockResolvedValue({});

    await DELETE(mockDeleteRequest("river-1"));

    expect(mockPrisma.userRiver.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_riverId: { userId: "user-1", riverId: "river-1" },
        },
      })
    );
  });
});
