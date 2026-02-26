/**
 * Tests for the Next.js middleware (route protection).
 *
 * Coverage:
 * - Public routes pass through without auth
 * - Protected routes redirect to /auth/signin when not authenticated
 * - Protected route sub-paths also redirect
 * - Authenticated users access protected routes normally
 * - Admin routes redirect to /auth/signin when not authenticated
 * - Admin routes redirect to / (home) for non-admin authenticated users
 * - Admin routes pass through for admin users
 * - callbackUrl is set correctly on redirect
 * - Matcher config excludes API routes, static files, etc.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock session state — tests set this before calling middleware
let mockSession: { user: { id: string; role?: string } } | null = null;

// Mock auth to return the session (standalone call, not a wrapper)
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() => Promise.resolve(mockSession)),
}));

// Import the middleware. It's now a regular async function.
import middleware, { config } from "@/middleware";

/**
 * Create a mock NextRequest.
 */
function createReq(pathname: string) {
  const url = new URL(`http://localhost${pathname}`);
  return {
    nextUrl: url,
  } as any;
}

function setSession(session: { user: { id: string; role?: string } } | null) {
  mockSession = session;
}

function adminUser() {
  return { user: { id: "admin-1", role: "admin" } };
}

function regularUser() {
  return { user: { id: "user-1", role: "user" } };
}

beforeEach(() => {
  mockSession = null;
});

describe("Middleware — public routes", () => {
  it("allows access to / without auth", async () => {
    setSession(null);
    const res = await middleware(createReq("/"));
    expect(res.status).not.toBe(307);
  });

  it("allows access to /rivers without auth", async () => {
    setSession(null);
    const res = await middleware(createReq("/rivers"));
    expect(res.status).not.toBe(307);
  });

  it("allows access to /deals without auth", async () => {
    setSession(null);
    const res = await middleware(createReq("/deals"));
    expect(res.status).not.toBe(307);
  });

  it("allows access to /map without auth", async () => {
    setSession(null);
    const res = await middleware(createReq("/map"));
    expect(res.status).not.toBe(307);
  });

  it("allows access to /rivers/some-id without auth (non-protected sub-path)", async () => {
    setSession(null);
    const res = await middleware(createReq("/rivers/river-123"));
    expect(res.status).not.toBe(307);
  });

  it("allows access to /auth/signin without auth", async () => {
    setSession(null);
    const res = await middleware(createReq("/auth/signin"));
    expect(res.status).not.toBe(307);
  });

  it("allows access to /search without auth", async () => {
    setSession(null);
    const res = await middleware(createReq("/search"));
    expect(res.status).not.toBe(307);
  });
});

describe("Middleware — protected routes (unauthenticated)", () => {
  it("redirects /trips to /auth/signin", async () => {
    setSession(null);
    const res = await middleware(createReq("/trips"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/auth/signin");
  });

  it("redirects /settings to /auth/signin", async () => {
    setSession(null);
    const res = await middleware(createReq("/settings"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/signin");
  });

  it("redirects /profile to /auth/signin", async () => {
    setSession(null);
    const res = await middleware(createReq("/profile"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/signin");
  });

  it("redirects /alerts to /auth/signin", async () => {
    setSession(null);
    const res = await middleware(createReq("/alerts"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/signin");
  });

  it("redirects /export to /auth/signin", async () => {
    setSession(null);
    const res = await middleware(createReq("/export"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/signin");
  });

  it("redirects /rivers/favorites to /auth/signin", async () => {
    setSession(null);
    const res = await middleware(createReq("/rivers/favorites"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/signin");
  });

  it("redirects /rivers/compare to /auth/signin", async () => {
    setSession(null);
    const res = await middleware(createReq("/rivers/compare"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/signin");
  });

  it("redirects protected sub-paths (e.g., /trips/trip-123)", async () => {
    setSession(null);
    const res = await middleware(createReq("/trips/trip-123"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/signin");
  });

  it("sets callbackUrl query param on redirect", async () => {
    setSession(null);
    const res = await middleware(createReq("/trips"));
    const location = res.headers.get("location") ?? "";
    const url = new URL(location);
    expect(url.searchParams.get("callbackUrl")).toBe("/trips");
  });

  it("sets callbackUrl for sub-path", async () => {
    setSession(null);
    const res = await middleware(createReq("/trips/abc"));
    const location = res.headers.get("location") ?? "";
    const url = new URL(location);
    expect(url.searchParams.get("callbackUrl")).toBe("/trips/abc");
  });
});

describe("Middleware — protected routes (authenticated)", () => {
  it("allows authenticated user to access /trips", async () => {
    setSession(regularUser());
    const res = await middleware(createReq("/trips"));
    expect(res.status).not.toBe(307);
  });

  it("allows authenticated user to access /settings", async () => {
    setSession(regularUser());
    const res = await middleware(createReq("/settings"));
    expect(res.status).not.toBe(307);
  });

  it("allows authenticated user to access /alerts", async () => {
    setSession(regularUser());
    const res = await middleware(createReq("/alerts"));
    expect(res.status).not.toBe(307);
  });

  it("allows authenticated user to access /rivers/favorites", async () => {
    setSession(regularUser());
    const res = await middleware(createReq("/rivers/favorites"));
    expect(res.status).not.toBe(307);
  });
});

describe("Middleware — admin routes", () => {
  it("redirects unauthenticated user from /admin to signin", async () => {
    setSession(null);
    const res = await middleware(createReq("/admin"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/auth/signin");
    const url = new URL(location);
    expect(url.searchParams.get("callbackUrl")).toBe("/admin");
  });

  it("redirects unauthenticated user from /admin/scrapers to signin", async () => {
    setSession(null);
    const res = await middleware(createReq("/admin/scrapers"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/signin");
  });

  it("redirects unauthenticated user from /admin/users to signin", async () => {
    setSession(null);
    const res = await middleware(createReq("/admin/users"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/signin");
  });

  it("redirects non-admin authenticated user from /admin to home (/)", async () => {
    setSession(regularUser());
    const res = await middleware(createReq("/admin"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    const url = new URL(location);
    expect(url.pathname).toBe("/");
  });

  it("redirects non-admin from /admin/scrapers to home", async () => {
    setSession(regularUser());
    const res = await middleware(createReq("/admin/scrapers"));
    expect(res.status).toBe(307);
    const url = new URL(res.headers.get("location") ?? "");
    expect(url.pathname).toBe("/");
  });

  it("redirects non-admin from /admin/users to home", async () => {
    setSession(regularUser());
    const res = await middleware(createReq("/admin/users"));
    expect(res.status).toBe(307);
    const url = new URL(res.headers.get("location") ?? "");
    expect(url.pathname).toBe("/");
  });

  it("allows admin user to access /admin", async () => {
    setSession(adminUser());
    const res = await middleware(createReq("/admin"));
    expect(res.status).not.toBe(307);
  });

  it("allows admin user to access /admin/scrapers", async () => {
    setSession(adminUser());
    const res = await middleware(createReq("/admin/scrapers"));
    expect(res.status).not.toBe(307);
  });

  it("allows admin user to access /admin/users", async () => {
    setSession(adminUser());
    const res = await middleware(createReq("/admin/users"));
    expect(res.status).not.toBe(307);
  });

  it("does NOT match /administrator as admin route", async () => {
    setSession(null);
    const res = await middleware(createReq("/administrator"));
    expect(res.status).not.toBe(307);
  });
});

describe("Middleware — config", () => {
  it("exports a matcher config", () => {
    expect(config).toBeDefined();
    expect(config.matcher).toBeDefined();
    expect(Array.isArray(config.matcher)).toBe(true);
  });

  it("matcher excludes API routes", () => {
    const pattern = config.matcher[0];
    expect(pattern).toContain("api");
  });

  it("matcher excludes _next/static", () => {
    const pattern = config.matcher[0];
    expect(pattern).toContain("_next/static");
  });

  it("matcher excludes _next/image", () => {
    const pattern = config.matcher[0];
    expect(pattern).toContain("_next/image");
  });

  it("matcher excludes favicon.ico", () => {
    const pattern = config.matcher[0];
    expect(pattern).toContain("favicon");
  });

  it("matcher excludes manifest.json and sw.js", () => {
    const pattern = config.matcher[0];
    expect(pattern).toContain("manifest");
    expect(pattern).toContain("sw");
  });
});
