import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Routes that require authentication — redirect to signin if not logged in.
 */
const PROTECTED_ROUTES = [
  "/trips",
  "/settings",
  "/profile",
  "/alerts",
  "/export",
  "/rivers/favorites",
  "/rivers/compare",
];

/**
 * Routes that require admin role — redirect to signin if not logged in,
 * redirect to home if logged in but not admin.
 */
const ADMIN_ROUTES_PREFIX = "/admin";

/**
 * Check whether the given pathname matches a protected route.
 * Matches exact paths and sub-paths (e.g., /trips/abc).
 */
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

/**
 * Check whether the given pathname is an admin route.
 */
function isAdminRoute(pathname: string): boolean {
  return (
    pathname === ADMIN_ROUTES_PREFIX ||
    pathname.startsWith(ADMIN_ROUTES_PREFIX + "/")
  );
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes — skip auth entirely (no auth() call = no UntrustedHost risk)
  if (!isProtectedRoute(pathname) && !isAdminRoute(pathname)) {
    return NextResponse.next();
  }

  // Only call auth() for routes that actually need it
  const session = await auth();
  const isLoggedIn = !!session?.user;
  const userRole = (session?.user as { role?: string } | undefined)?.role;

  // Admin routes: need auth + admin role
  if (isAdminRoute(pathname)) {
    if (!isLoggedIn) {
      const signInUrl = new URL("/auth/signin", req.nextUrl.origin);
      signInUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signInUrl);
    }
    if (userRole !== "admin") {
      return NextResponse.redirect(new URL("/", req.nextUrl.origin));
    }
    return NextResponse.next();
  }

  // Protected routes: need auth
  if (!isLoggedIn) {
    const signInUrl = new URL("/auth/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (handled by their own auth)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, manifest.json, sw.js, icons
     */
    "/((?!api|_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|icons|offline\\.html).*)",
  ],
};
