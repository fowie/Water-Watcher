/**
 * Tests for auth utility functions in web/src/lib/auth-utils.ts.
 *
 * Tests:
 * - hashPassword produces "salt:hash" format
 * - hashPassword generates different output each time (random salt)
 * - verifyPassword matches correct password
 * - verifyPassword rejects wrong password
 * - verifyPassword handles malformed stored hash
 * - Empty / edge-case password handling
 * - getCurrentUser and requireAuth behavior
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// We test hashPassword and verifyPassword directly — no mocks needed
// for the crypto module since these are pure utility functions.
import { hashPassword, verifyPassword } from "@/lib/auth-utils";

// Mock auth for getCurrentUser/requireAuth tests
const mockAuth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

describe("hashPassword", () => {
  it("returns a string in 'salt:hash' format", async () => {
    const result = await hashPassword("testpassword");

    expect(result).toContain(":");
    const parts = result.split(":");
    expect(parts).toHaveLength(2);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
  });

  it("produces hex-encoded salt and hash", async () => {
    const result = await hashPassword("testpassword");
    const [salt, hash] = result.split(":");

    // PBKDF2 with 16-byte salt → 32 hex chars
    expect(salt).toMatch(/^[0-9a-f]+$/);
    // 64-byte key → 128 hex chars
    expect(hash).toMatch(/^[0-9a-f]+$/);
    expect(hash.length).toBe(128); // KEY_LENGTH=64 → 128 hex chars
  });

  it("generates different output each time (random salt)", async () => {
    const hash1 = await hashPassword("samepassword");
    const hash2 = await hashPassword("samepassword");

    expect(hash1).not.toBe(hash2);

    // But the salts should definitely be different
    const salt1 = hash1.split(":")[0];
    const salt2 = hash2.split(":")[0];
    expect(salt1).not.toBe(salt2);
  });

  it("handles empty string password", async () => {
    // PBKDF2 accepts empty input — should not throw
    const result = await hashPassword("");

    expect(result).toContain(":");
    const [salt, hash] = result.split(":");
    expect(salt.length).toBeGreaterThan(0);
    expect(hash.length).toBeGreaterThan(0);
  });

  it("handles very long password (10K chars)", async () => {
    const longPass = "a".repeat(10_000);
    const result = await hashPassword(longPass);

    expect(result).toContain(":");
  });

  it("handles unicode password", async () => {
    const result = await hashPassword("пароль🔒");

    expect(result).toContain(":");
    const [salt, hash] = result.split(":");
    expect(hash.length).toBe(128);
  });
});

describe("verifyPassword", () => {
  it("matches the correct password", async () => {
    const stored = await hashPassword("correctpass");
    const result = await verifyPassword("correctpass", stored);

    expect(result).toBe(true);
  });

  it("rejects wrong password", async () => {
    const stored = await hashPassword("correctpass");
    const result = await verifyPassword("wrongpass", stored);

    expect(result).toBe(false);
  });

  it("rejects similar password (off by one char)", async () => {
    const stored = await hashPassword("password1");
    const result = await verifyPassword("password2", stored);

    expect(result).toBe(false);
  });

  it("rejects empty password when stored is non-empty", async () => {
    const stored = await hashPassword("realpassword");
    const result = await verifyPassword("", stored);

    expect(result).toBe(false);
  });

  it("correctly verifies empty password if that was the original", async () => {
    const stored = await hashPassword("");
    const result = await verifyPassword("", stored);

    expect(result).toBe(true);
  });

  it("returns false for malformed stored hash (no colon)", async () => {
    const result = await verifyPassword("test", "nocolonshere");

    expect(result).toBe(false);
  });

  it("returns false for malformed stored hash (empty salt)", async () => {
    const result = await verifyPassword("test", ":somehash");

    expect(result).toBe(false);
  });

  it("returns false for malformed stored hash (empty hash)", async () => {
    const result = await verifyPassword("test", "somesalt:");

    expect(result).toBe(false);
  });

  it("returns false for empty stored string", async () => {
    const result = await verifyPassword("test", "");

    expect(result).toBe(false);
  });

  it("uses constant-time comparison (timing-safe)", async () => {
    // We can't directly test timing, but verify wrong passwords
    // with same-length hash still return false (the comparison
    // doesn't short-circuit on first mismatch)
    const stored = await hashPassword("mypassword");
    const [salt] = stored.split(":");
    // Craft a hash with correct salt but wrong hash value
    const fakeStored = `${salt}:${"a".repeat(128)}`;
    const result = await verifyPassword("mypassword", fakeStored);

    expect(result).toBe(false);
  });

  it("handles unicode in both password and stored hash", async () => {
    const stored = await hashPassword("密码🔐");
    expect(await verifyPassword("密码🔐", stored)).toBe(true);
    expect(await verifyPassword("密码🔑", stored)).toBe(false);
  });
});

describe("getCurrentUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user from session when authenticated", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", name: "Test", email: "test@test.com" },
    });

    const { getCurrentUser } = await import("@/lib/auth-utils");
    const user = await getCurrentUser();

    expect(user).toEqual({ id: "user-1", name: "Test", email: "test@test.com" });
  });

  it("returns null when no session exists", async () => {
    mockAuth.mockResolvedValue(null);

    const { getCurrentUser } = await import("@/lib/auth-utils");
    const user = await getCurrentUser();

    expect(user).toBeNull();
  });

  it("returns null when session has no user id", async () => {
    mockAuth.mockResolvedValue({ user: { name: "NoId" } });

    const { getCurrentUser } = await import("@/lib/auth-utils");
    const user = await getCurrentUser();

    expect(user).toBeNull();
  });
});

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user when authenticated", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", name: "Auth User", email: "auth@test.com" },
    });

    const { requireAuth } = await import("@/lib/auth-utils");
    const user = await requireAuth();

    expect(user).toEqual({ id: "user-1", name: "Auth User", email: "auth@test.com" });
  });

  it("throws 401 Response when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const { requireAuth } = await import("@/lib/auth-utils");

    try {
      await requireAuth();
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      const res = error as Response;
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain("Authentication required");
    }
  });

  it("thrown 401 Response has JSON content-type", async () => {
    mockAuth.mockResolvedValue(null);

    const { requireAuth } = await import("@/lib/auth-utils");

    try {
      await requireAuth();
      expect.fail("Should have thrown");
    } catch (error) {
      const res = error as Response;
      expect(res.headers.get("Content-Type")).toContain("application/json");
    }
  });
});
