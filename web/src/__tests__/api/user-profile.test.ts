/**
 * Tests for the User Profile API route handler (GET/PATCH /api/user/profile).
 *
 * Mocks Prisma client and auth middleware, then tests:
 * - GET returns user profile with river/filter counts
 * - GET returns 404 when user not found
 * - PATCH updates name
 * - PATCH updates email
 * - PATCH with duplicate email returns 409
 * - PATCH with invalid email returns 400
 * - PATCH with empty name returns 400
 * - PATCH with no fields returns 400
 * - Both require authentication (401 without session)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
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

import { GET, PATCH } from "@/app/api/user/profile/route";

function mockRequest(
  method: string = "GET",
  body?: unknown
): Request {
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return new Request("http://localhost/api/user/profile", init);
}

const MOCK_USER = {
  id: "user-1",
  name: "River Runner",
  email: "runner@rapids.com",
  createdAt: new Date("2026-01-15T00:00:00Z"),
  _count: {
    trackedRivers: 5,
    dealFilters: 3,
  },
};

describe("GET /api/user/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without authentication", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await GET(mockRequest());
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain("Authentication required");
  });

  it("returns 401 when session has no user", async () => {
    mockAuth.mockResolvedValue({ user: undefined });

    const res = await GET(mockRequest());

    expect(res.status).toBe(401);
  });

  it("returns user profile with stats", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_USER);

    const res = await GET(mockRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.id).toBe("user-1");
    expect(data.name).toBe("River Runner");
    expect(data.email).toBe("runner@rapids.com");
    expect(data.riverCount).toBe(5);
    expect(data.filterCount).toBe(3);
  });

  it("does not leak passwordHash", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUnique.mockResolvedValue(MOCK_USER);

    const res = await GET(mockRequest());
    const data = await res.json();

    expect(data.passwordHash).toBeUndefined();
    expect(data.password).toBeUndefined();
    expect(data._count).toBeUndefined();
  });

  it("returns 404 when user not found in DB", async () => {
    mockAuth.mockResolvedValue({ user: { id: "nonexistent" } });
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await GET(mockRequest());
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain("not found");
  });

  it("returns 500 on database error", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUnique.mockRejectedValue(new Error("DB connection failed"));

    const res = await GET(mockRequest());
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toContain("Internal server error");
  });

  it("passes correct user ID to Prisma query", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-42" } });
    mockPrisma.user.findUnique.mockResolvedValue({
      ...MOCK_USER,
      id: "user-42",
    });

    await GET(mockRequest());

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-42" },
      })
    );
  });
});

describe("PATCH /api/user/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without authentication", async () => {
    mockAuth.mockResolvedValue(null);

    const res = await PATCH(mockRequest("PATCH", { name: "New Name" }));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain("Authentication required");
  });

  it("updates name successfully", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.update.mockResolvedValue({
      ...MOCK_USER,
      name: "Updated Name",
    });

    const res = await PATCH(mockRequest("PATCH", { name: "Updated Name" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.name).toBe("Updated Name");
  });

  it("updates email successfully", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUnique.mockResolvedValue(null); // no duplicate
    mockPrisma.user.update.mockResolvedValue({
      ...MOCK_USER,
      email: "new@email.com",
    });

    const res = await PATCH(mockRequest("PATCH", { email: "new@email.com" }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.email).toBe("new@email.com");
  });

  it("updates both name and email", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.update.mockResolvedValue({
      ...MOCK_USER,
      name: "New Runner",
      email: "newrunner@rapids.com",
    });

    const res = await PATCH(
      mockRequest("PATCH", { name: "New Runner", email: "newrunner@rapids.com" })
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.name).toBe("New Runner");
    expect(data.email).toBe("newrunner@rapids.com");
  });

  it("returns 400 when no fields provided", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const res = await PATCH(mockRequest("PATCH", {}));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("returns 400 when name is empty string", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const res = await PATCH(mockRequest("PATCH", { name: "" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("empty");
  });

  it("returns 400 when name is whitespace only", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const res = await PATCH(mockRequest("PATCH", { name: "   " }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("empty");
  });

  it("returns 400 for invalid email format", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const res = await PATCH(mockRequest("PATCH", { email: "not-an-email" }));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("email");
  });

  it("returns 400 for email without domain", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const res = await PATCH(mockRequest("PATCH", { email: "user@" }));
    const data = await res.json();

    expect(res.status).toBe(400);
  });

  it("returns 409 when email is already in use by another user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "other-user",
      email: "taken@email.com",
    });

    const res = await PATCH(mockRequest("PATCH", { email: "taken@email.com" }));
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toContain("already in use");
  });

  it("allows updating email to same email (user's own)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    // findUnique returns the current user's record (same ID)
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "runner@rapids.com",
    });
    mockPrisma.user.update.mockResolvedValue(MOCK_USER);

    const res = await PATCH(mockRequest("PATCH", { email: "runner@rapids.com" }));

    expect(res.status).toBe(200);
  });

  it("returns 400 when name is not a string", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const res = await PATCH(mockRequest("PATCH", { name: 123 }));
    const data = await res.json();

    expect(res.status).toBe(400);
  });

  it("returns 400 when email is not a string", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const res = await PATCH(mockRequest("PATCH", { email: 42 }));
    const data = await res.json();

    expect(res.status).toBe(400);
  });

  it("returns 500 on database error during update", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.update.mockRejectedValue(new Error("DB error"));

    const res = await PATCH(mockRequest("PATCH", { name: "Good Name" }));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toContain("Internal server error");
  });

  it("response includes counts after update", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.user.update.mockResolvedValue(MOCK_USER);

    const res = await PATCH(mockRequest("PATCH", { name: "Counts Check" }));
    const data = await res.json();

    expect(data.riverCount).toBe(5);
    expect(data.filterCount).toBe(3);
  });
});
