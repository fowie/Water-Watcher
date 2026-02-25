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

// Mock auth as a pass-through wrapper: auth(callback) returns callback itself.
// This lets us call the middleware callback directly with mock requests.
vi.mock("@/lib/auth", () => ({
  auth: (callback: Function) => callback,
}));

// Import the middleware. With the mock above, default export IS the callback.
import middleware, { config } from "@/middleware";

/**
 * Create a mock request simulating what NextAuth's auth() wrapper provides.
 * The real wrapper attaches `req.auth` with the session data.
 */
function createReq(
  pathname: string,
  session: { user: { id: string; role?: string } } | null = null
) {
  const url = new URL(`http://localhost${pathname}`);
  return {
    nextUrl: url,
    auth: session,
  } as any;
}

function adminUser() {
  return { user: { id: "admin-1", role: "admin" } };
}

function regularUser() {
  return { user: { id: "user-1", role: "user" } };
}

describe("Middleware — public routes", () => {
  it("allows access to / without auth", () => {
    const res = middleware(createReq("/", null));
    // NextResponse.next() sets x-middleware-next header; it's NOT a redirect
    expect(res.status).not.toBe(307);
  });

  it("allows access to /rivers without auth", () => {
    const res = middleware(createReq("/rivers", null));
    expect(res.status).not.toBe(307);
  });

  it("allows access to /deals without auth", () => {
    const res = middleware(createReq("/deals", null));
    expect(res.status).not.toBe(307);
  });

  it("allows access to /map without auth", () => {
    const res = middleware(createReq("/map", null));
    expect(res.status).not.toBe(307);
  });

  it("allows access to /rivers/some-id without auth (non-protected sub-path)", () => {
    const res = middleware(createReq("/rivers/river-123", null));
    expect(res.status).not.toBe(307);
  });

  it("allows access to /auth/signin without auth", () => {
    const res = middleware(createReq("/auth/signin", null));
    expect(res.status).not.toBe(307);
  });

  it("allows access to /search without auth", () => {
    const res = middleware(createReq("/search", null));
    expect(res.status).not.toBe(307);
  });
});

describe("Middleware — protected routes (unauthenticated)", () => {
  it("redirects /trips to /auth/signin", () => {
    const res = middleware(createReq("/trips", null));
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/auth/signin");
  });

  it("redirects /settings to /auth/signin", () => {
    const res = middleware(createReq("/settings", null));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/signin");
  });

  it("redirects /profile to /auth/signin", () => {
    const res = middleware(createReq("/profile", null));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/signin");
  });

  it("redirects /alerts to /auth/signin", () => {
    const res = middleware(createReq("/alerts", null));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/signin");
  });

  it("redirects /export to /auth/signin", () => {
    const res = middleware(createReq("/export", null));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/signin");
  });

  it("redirects /rivers/favorites to /auth/signin", () => {
    const res = middleware(createReq("/rivers/favorites", null));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/signin");
  });

  it("redirects /rivers/compare to /auth/signin", () => {
    const res = middleware(createReq("/rivers/compare", null));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/signin");
  });

  it("redirects protected sub-paths (e.g., /trips/trip-123)", () => {
    const res = middleware(createReq("/trips/trip-123", null));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/signin");
  });

  it("sets callbackUrl query param on redirect", () => {
    const res = middleware(createReq("/trips", null));
    const location = res.headers.get("location") ?? "";
    const url = new URL(location);
    expect(url.searchParams.get("callbackUrl")).toBe("/trips");
  });

  it("sets callbackUrl for sub-path", () => {
    const res = middleware(createReq("/trips/abc", null));
    const location = res.headers.get("location") ?? "";
    const url = new URL(location);
    expect(url.searchParams.get("callbackUrl")).toBe("/trips/abc");
  });
});

describe("Middleware — protected routes (authenticated)", () => {
  it("allows authenticated user to access /trips", () => {
    const res = middleware(createReq("/trips", regularUser()));
    expect(res.status).not.toBe(307);
  });

  it("allows authenticated user to access /settings", () => {
    const res = middleware(createReq("/settings", regularUser()));
    expect(res.status).not.toBe(307);
  });

  it("allows authenticated user to access /alerts", () => {
    const res = middleware(createReq("/alerts", regularUser()));
    expect(res.status).not.toBe(307);
  });

  it("allows authenticated user to access /rivers/favorites", () => {
    const res = middleware(createReq("/rivers/favorites", regularUser()));
    expect(res.status).not.toBe(307);
  });
});

describe("Middleware — admin routes", () => {
  it("redirects unauthenticated user from /admin to signin", () => {
    const res = middleware(createReq("/admin", null));
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/auth/signin");
    const url = new URL(location);
    expect(url.searchParams.get("callbackUrl")).toBe("/admin");
  });

  it("redirects unauthenticated user from /admin/scrapers to signin", () => {
    const res = middleware(createReq("/admin/scrapers", null));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/signin");
  });

  it("redirects unauthenticated user from /admin/users to signin", () => {
    const res = middleware(createReq("/admin/users", null));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/auth/signin");
  });

  it("redirects non-admin authenticated user from /admin to home (/)", () => {
    const res = middleware(createReq("/admin", regularUser()));
    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    const url = new URL(location);
    expect(url.pathname).toBe("/");
  });

  it("redirects non-admin from /admin/scrapers to home", () => {
    const res = middleware(createReq("/admin/scrapers", regularUser()));
    expect(res.status).toBe(307);
    const url = new URL(res.headers.get("location") ?? "");
    expect(url.pathname).toBe("/");
  });

  it("redirects non-admin from /admin/users to home", () => {
    const res = middleware(createReq("/admin/users", regularUser()));
    expect(res.status).toBe(307);
    const url = new URL(res.headers.get("location") ?? "");
    expect(url.pathname).toBe("/");
  });

  it("allows admin user to access /admin", () => {
    const res = middleware(createReq("/admin", adminUser()));
    expect(res.status).not.toBe(307);
  });

  it("allows admin user to access /admin/scrapers", () => {
    const res = middleware(createReq("/admin/scrapers", adminUser()));
    expect(res.status).not.toBe(307);
  });

  it("allows admin user to access /admin/users", () => {
    const res = middleware(createReq("/admin/users", adminUser()));
    expect(res.status).not.toBe(307);
  });

  it("does NOT match /administrator as admin route", () => {
    const res = middleware(createReq("/administrator", null));
    // /administrator is not in protected or admin routes, so it passes through
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
