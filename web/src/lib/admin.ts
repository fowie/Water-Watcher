import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * Check if the current session user has admin role.
 * Returns the session if authenticated and admin.
 * Returns a NextResponse error if not authenticated (401) or not admin (403).
 */
export async function requireAdmin(): Promise<
  | { user: { id: string; role: string; email?: string | null; name?: string | null } }
  | NextResponse
> {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const role = (session.user as { role?: string }).role;
  if (role !== "admin") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  return {
    user: {
      id: session.user.id,
      role: "admin",
      email: session.user.email,
      name: session.user.name,
    },
  };
}

/**
 * Type guard to check if requireAdmin returned an error response.
 */
export function isAdminError(
  result: Awaited<ReturnType<typeof requireAdmin>>
): result is NextResponse {
  return result instanceof NextResponse;
}
