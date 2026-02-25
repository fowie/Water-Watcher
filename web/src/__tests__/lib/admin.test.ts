/**
 * Tests for the admin role check utilities (web/src/lib/admin.ts).
 *
 * Functions:
 *   requireAdmin()  — Checks session for admin role, returns user or 401/403 NextResponse
 *   isAdminError()  — Type guard: true if requireAdmin returned a NextResponse error
 *
 * Also tests the auth-utils requireAdmin() which throws instead of returning.
 *
 * Coverage:
 * - requireAdmin() passes for admin users (returns user object)
 * - requireAdmin() returns 403 NextResponse for regular users
 * - requireAdmin() returns 401 NextResponse for unauthenticated
 * - requireAdmin() returns 401 when session has no user ID
 * - isAdminError() returns true for NextResponse, false for user object
 * - Auth callbacks include role in JWT/session (verified from source)
 * - auth-utils requireAdmin() throws 403 for non-admin
 * - auth-utils requireAdmin() throws 401 for unauthenticated
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const mockAuth = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

import { requireAdmin, isAdminError } from "@/lib/admin";
import {
  requireAdmin as requireAdminUtil,
  getCurrentUser,
} from "@/lib/auth-utils";

// ═══════════════════════════════════════════════════════
//  requireAdmin() from @/lib/admin
// ═══════════════════════════════════════════════════════

describe("requireAdmin (lib/admin)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Admin passes ────────────────────────────────

  it("returns user object for admin session", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "admin-1", role: "admin", email: "admin@test.com", name: "Admin" },
    });

    const result = await requireAdmin();
    expect(isAdminError(result)).toBe(false);
    expect(result).toHaveProperty("user");

    const { user } = result as { user: { id: string; role: string } };
    expect(user.id).toBe("admin-1");
    expect(user.role).toBe("admin");
  });

  it("returns user with email and name fields", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "admin-1", role: "admin", email: "admin@test.com", name: "Admin User" },
    });

    const result = await requireAdmin();
    const { user } = result as { user: { id: string; email: string | null; name: string | null } };
    expect(user.email).toBe("admin@test.com");
    expect(user.name).toBe("Admin User");
  });

  // ─── Non-admin → 403 ────────────────────────────

  it("returns 403 NextResponse for regular user", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", role: "user", email: "user@test.com" },
    });

    const result = await requireAdmin();
    expect(isAdminError(result)).toBe(true);

    const response = result as NextResponse;
    expect(response.status).toBe(403);

    const data = await response.json();
    expect(data.error).toContain("Admin access required");
  });

  it("returns 403 when role is undefined", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1" },
    });

    const result = await requireAdmin();
    expect(isAdminError(result)).toBe(true);
    expect((result as NextResponse).status).toBe(403);
  });

  it("returns 403 when role is empty string", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", role: "" },
    });

    const result = await requireAdmin();
    expect(isAdminError(result)).toBe(true);
    expect((result as NextResponse).status).toBe(403);
  });

  // ─── Unauthenticated → 401 ──────────────────────

  it("returns 401 NextResponse when session is null", async () => {
    mockAuth.mockResolvedValue(null);

    const result = await requireAdmin();
    expect(isAdminError(result)).toBe(true);

    const response = result as NextResponse;
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error).toContain("Authentication required");
  });

  it("returns 401 when session has no user", async () => {
    mockAuth.mockResolvedValue({ user: undefined });

    const result = await requireAdmin();
    expect(isAdminError(result)).toBe(true);
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns 401 when session user has no id", async () => {
    mockAuth.mockResolvedValue({ user: { name: "No ID", role: "admin" } });

    const result = await requireAdmin();
    expect(isAdminError(result)).toBe(true);
    expect((result as NextResponse).status).toBe(401);
  });

  it("returns 401 when session user id is empty string", async () => {
    mockAuth.mockResolvedValue({ user: { id: "", role: "admin" } });

    const result = await requireAdmin();
    expect(isAdminError(result)).toBe(true);
    expect((result as NextResponse).status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════
//  isAdminError() type guard
// ═══════════════════════════════════════════════════════

describe("isAdminError", () => {
  it("returns true for NextResponse instances", () => {
    const response = NextResponse.json({ error: "test" }, { status: 403 });
    expect(isAdminError(response)).toBe(true);
  });

  it("returns false for user object", () => {
    const user = { user: { id: "admin-1", role: "admin", email: null, name: null } };
    expect(isAdminError(user)).toBe(false);
  });

  it("returns false for a plain object", () => {
    const obj = { user: { id: "x", role: "admin", email: null, name: null } };
    expect(isAdminError(obj)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════
//  requireAdmin() from @/lib/auth-utils (throws variant)
// ═══════════════════════════════════════════════════════

describe("requireAdmin (auth-utils)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user for admin session", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "admin-1", role: "admin", email: "admin@test.com", name: "Admin" },
    });

    const user = await requireAdminUtil();
    expect(user.id).toBe("admin-1");
    expect(user.role).toBe("admin");
  });

  it("throws 403 Response for non-admin user", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", role: "user", email: "user@test.com" },
    });

    try {
      await requireAdminUtil();
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(Response);
      const res = e as Response;
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Admin access required");
    }
  });

  it("throws 401 Response for unauthenticated user", async () => {
    mockAuth.mockResolvedValue(null);

    try {
      await requireAdminUtil();
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(Response);
      const res = e as Response;
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain("Authentication required");
    }
  });

  it("thrown 403 has JSON content type", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", role: "user" },
    });

    try {
      await requireAdminUtil();
      expect.fail("Should have thrown");
    } catch (e) {
      const res = e as Response;
      expect(res.headers.get("Content-Type")).toBe("application/json");
    }
  });
});

// ═══════════════════════════════════════════════════════
//  Auth callbacks include role (source verification)
// ═══════════════════════════════════════════════════════

describe("auth.ts role handling", () => {
  it("JWT callback sets token.role from user", () => {
    const authSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/auth.ts"),
      "utf-8"
    );
    // JWT callback should set token.role
    expect(authSource).toContain("token.role");
    // Should default to "user" when role is missing
    expect(authSource).toContain('"user"');
  });

  it("session callback sets user role from token", () => {
    const authSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/auth.ts"),
      "utf-8"
    );
    // Session callback should read token.role and set it on session.user
    expect(authSource).toContain("token?.role");
    expect(authSource).toContain("session.user");
  });

  it("session strategy is JWT", () => {
    const authSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/lib/auth.ts"),
      "utf-8"
    );
    expect(authSource).toContain('strategy: "jwt"');
  });
});
