/**
 * Tests for the Auth Registration API route handler (POST /api/auth/register).
 *
 * Mocks Prisma client and auth-utils hashPassword, then tests:
 * - Successful registration (creates user, returns user without passwordHash)
 * - Duplicate email returns 409
 * - Missing fields return 400
 * - Weak/short password returns 400
 * - Invalid email format returns 400
 * - Very long email/name handling
 * - Empty body / malformed JSON
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
}));

const mockHashPassword = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/auth-utils", () => ({
  hashPassword: mockHashPassword,
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

import { POST } from "@/app/api/auth/register/route";

function mockRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHashPassword.mockResolvedValue("salt123:hash456");
  });

  // ─── Happy path ─────────────────────────────────────────

  it("creates a user and returns 201 with user info (no passwordHash)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "user-1",
      email: "river@example.com",
      name: "River Runner",
      createdAt: new Date("2026-02-24T00:00:00Z"),
    });

    const res = await POST(
      mockRequest({ email: "river@example.com", password: "secureP4ss!", name: "River Runner" })
    );
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.id).toBe("user-1");
    expect(data.email).toBe("river@example.com");
    expect(data.name).toBe("River Runner");
    expect(data.passwordHash).toBeUndefined();
    expect(data.password).toBeUndefined();
  });

  it("calls hashPassword with the provided password", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "user-2",
      email: "test@test.com",
      name: null,
      createdAt: new Date(),
    });

    await POST(mockRequest({ email: "test@test.com", password: "longpassword" }));

    expect(mockHashPassword).toHaveBeenCalledWith("longpassword");
  });

  it("passes the hashed password to prisma.user.create", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockHashPassword.mockResolvedValue("randomsalt:hashedddd");
    mockPrisma.user.create.mockResolvedValue({
      id: "user-3",
      email: "a@b.com",
      name: null,
      createdAt: new Date(),
    });

    await POST(mockRequest({ email: "a@b.com", password: "12345678" }));

    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordHash: "randomsalt:hashedddd" }),
      })
    );
  });

  it("allows optional name field (registers without name)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "user-4",
      email: "noname@example.com",
      name: null,
      createdAt: new Date(),
    });

    const res = await POST(
      mockRequest({ email: "noname@example.com", password: "password123" })
    );

    expect(res.status).toBe(201);
  });

  // ─── Duplicate email ───────────────────────────────────

  it("returns 409 when email already exists", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "existing-user",
      email: "taken@example.com",
    });

    const res = await POST(
      mockRequest({ email: "taken@example.com", password: "password123" })
    );
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.error).toContain("already exists");
  });

  it("does not call hashPassword when email is duplicate", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "x", email: "dup@example.com" });

    await POST(mockRequest({ email: "dup@example.com", password: "password123" }));

    expect(mockHashPassword).not.toHaveBeenCalled();
  });

  // ─── Missing / invalid fields → 400 ───────────────────

  it("returns 400 when email is missing", async () => {
    const res = await POST(mockRequest({ password: "password123" }));

    expect(res.status).toBe(400);
  });

  it("returns 400 when password is missing", async () => {
    const res = await POST(mockRequest({ email: "valid@example.com" }));

    expect(res.status).toBe(400);
  });

  it("returns 400 when body is empty object", async () => {
    const res = await POST(mockRequest({}));

    expect(res.status).toBe(400);
  });

  it("returns error details on validation failure", async () => {
    const res = await POST(mockRequest({}));
    const data = await res.json();

    expect(data.error).toBeDefined();
    expect(data.details).toBeDefined();
  });

  // ─── Invalid email format ─────────────────────────────

  it("returns 400 for invalid email format (no @)", async () => {
    const res = await POST(
      mockRequest({ email: "notanemail", password: "password123" })
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid email format (no domain)", async () => {
    const res = await POST(
      mockRequest({ email: "user@", password: "password123" })
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 for email with spaces", async () => {
    const res = await POST(
      mockRequest({ email: "user @example.com", password: "password123" })
    );

    expect(res.status).toBe(400);
  });

  // ─── Weak / short password ────────────────────────────

  it("returns 400 when password is shorter than 8 characters", async () => {
    const res = await POST(
      mockRequest({ email: "short@example.com", password: "1234567" })
    );
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(JSON.stringify(data)).toContain("8");
  });

  it("accepts password of exactly 8 characters", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "user-8",
      email: "exact8@example.com",
      name: null,
      createdAt: new Date(),
    });

    const res = await POST(
      mockRequest({ email: "exact8@example.com", password: "12345678" })
    );

    expect(res.status).toBe(201);
  });

  it("returns 400 for empty string password", async () => {
    const res = await POST(
      mockRequest({ email: "empty@example.com", password: "" })
    );

    expect(res.status).toBe(400);
  });

  // ─── Very long inputs ─────────────────────────────────

  it("handles very long email (255 chars)", async () => {
    const longEmail = "a".repeat(245) + "@test.com";
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "user-long",
      email: longEmail,
      name: null,
      createdAt: new Date(),
    });

    const res = await POST(
      mockRequest({ email: longEmail, password: "password123" })
    );

    // Should either succeed or fail gracefully — no 500
    expect([201, 400]).toContain(res.status);
  });

  it("handles very long name (500 chars)", async () => {
    const longName = "A".repeat(500);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "user-longname",
      email: "longname@example.com",
      name: longName,
      createdAt: new Date(),
    });

    const res = await POST(
      mockRequest({ email: "longname@example.com", password: "password123", name: longName })
    );

    // Should succeed — name field has no max length in the schema
    expect(res.status).toBe(201);
  });

  it("handles very long password (1000 chars)", async () => {
    const longPassword = "x".repeat(1000);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "user-longpw",
      email: "longpw@example.com",
      name: null,
      createdAt: new Date(),
    });

    const res = await POST(
      mockRequest({ email: "longpw@example.com", password: longPassword })
    );

    // Long passwords are fine — PBKDF2 handles any length
    expect(res.status).toBe(201);
  });

  // ─── Error handling ────────────────────────────────────

  it("returns 500 when prisma.user.create throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockRejectedValue(new Error("DB connection lost"));

    const res = await POST(
      mockRequest({ email: "db@example.com", password: "password123" })
    );

    expect(res.status).toBe(500);
  });

  it("returns 500 when hashPassword throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockHashPassword.mockRejectedValue(new Error("crypto failure"));

    const res = await POST(
      mockRequest({ email: "crypto@example.com", password: "password123" })
    );

    expect(res.status).toBe(500);
  });

  it("does not leak internal error message on DB failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockRejectedValue(new Error("FATAL: connection pool exhausted (secret_host:5432)"));

    const res = await POST(
      mockRequest({ email: "leak@example.com", password: "password123" })
    );
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(JSON.stringify(data)).not.toContain("secret_host");
    expect(JSON.stringify(data)).not.toContain("connection pool");
  });

  // ─── Select clause verification ──────────────────────

  it("uses select clause to exclude passwordHash from response", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "user-select",
      email: "select@example.com",
      name: null,
      createdAt: new Date(),
    });

    await POST(
      mockRequest({ email: "select@example.com", password: "password123" })
    );

    const createCall = mockPrisma.user.create.mock.calls[0][0];
    expect(createCall.select).toBeDefined();
    expect(createCall.select.id).toBe(true);
    expect(createCall.select.email).toBe(true);
    // passwordHash must NOT be selected
    expect(createCall.select.passwordHash).toBeUndefined();
  });
});
