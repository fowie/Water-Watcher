import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

type RouteHandler = (
  request: Request,
  context?: unknown
) => Promise<Response | NextResponse>;

/**
 * Higher-order function that wraps an API route handler with authentication.
 * The authenticated user's ID is injected into `request.headers` as `x-user-id`
 * so downstream handlers can read it without re-fetching the session.
 *
 * Usage:
 *   export const POST = withAuth(async (request) => {
 *     const userId = request.headers.get("x-user-id")!;
 *     // ... handle request
 *   });
 */
export function withAuth(handler: RouteHandler): RouteHandler {
  return async (request: Request, context?: unknown) => {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Clone the request with the user ID header injected
    const authedRequest = new Request(request.url, {
      method: request.method,
      headers: new Headers(request.headers),
      body: request.body,
      // @ts-expect-error duplex needed for body streams
      duplex: "half",
    });
    authedRequest.headers.set("x-user-id", session.user.id);

    return handler(authedRequest, context);
  };
}
