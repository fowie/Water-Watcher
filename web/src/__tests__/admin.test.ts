/**
 * Tests for the admin helper (web/src/lib/admin.ts).
 *
 * Coverage:
 * - requireAdmin returns session when user is admin
 * - requireAdmin returns 401 when not authenticated
 * - requireAdmin returns 403 when user is not admin
 * - isAdminError correctly identifies NextResponse vs session
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mockAuth = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

import { requireAdmin, isAdminError } from "@/lib/admin";

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns session when user is admin", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "admin-1", email: "admin@test.com", name: "Admin", role: "admin" },
    });

    const result = await requireAdmin();
    expect(isAdminError(result)).toBe(false);
    if (!isAdminError(result)) {
      expect(result.user.id).toBe("admin-1");
      expect(result.user.role).toBe("admin");
    }
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await requireAdmin();
    expect(isAdminError(result)).toBe(true);
    if (isAdminError(result)) {
      expect(result.status).toBe(401);
      const data = await result.json();
      expect(data.error).toContain("Authentication required");
    }
  });

  it("returns 401 when session has no user id", async () => {
    mockAuth.mockResolvedValue({ user: { name: "Test" } });

    const result = await requireAdmin();
    expect(isAdminError(result)).toBe(true);
    if (isAdminError(result)) {
      expect(result.status).toBe(401);
    }
  });

  it("returns 403 when user has role 'user'", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", role: "user" },
    });

    const result = await requireAdmin();
    expect(isAdminError(result)).toBe(true);
    if (isAdminError(result)) {
      expect(result.status).toBe(403);
      const data = await result.json();
      expect(data.error).toContain("Admin");
    }
  });

  it("returns 403 when user has no role field", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1" },
    });

    const result = await requireAdmin();
    expect(isAdminError(result)).toBe(true);
    if (isAdminError(result)) {
      expect(result.status).toBe(403);
    }
  });
});

describe("isAdminError", () => {
  it("returns true for NextResponse", () => {
    const response = NextResponse.json({ error: "test" }, { status: 403 });
    expect(isAdminError(response)).toBe(true);
  });

  it("returns false for session object", () => {
    const session = { user: { id: "admin-1", role: "admin", email: null, name: null } };
    expect(isAdminError(session)).toBe(false);
  });
});
