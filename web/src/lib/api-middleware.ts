import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit, defaultConfig } from "@/lib/rate-limit";
import type { RateLimitConfig } from "@/lib/rate-limit";

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

/**
 * Higher-order function that wraps an API route handler with rate limiting.
 * Adds X-RateLimit-Remaining and X-RateLimit-Reset headers to all responses.
 * Returns 429 Too Many Requests with Retry-After header when limit exceeded.
 *
 * Can be composed with withAuth:
 *   export const POST = withRateLimit(withAuth(handler), strictAuthConfig);
 */
export function withRateLimit(
  handler: RouteHandler,
  config: RateLimitConfig = defaultConfig
): RouteHandler {
  return async (request: Request, context?: unknown) => {
    const result = rateLimit(request, config);

    if (!result.success) {
      const retryAfter = Math.max(1, result.reset - Math.ceil(Date.now() / 1000));
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(result.reset),
          },
        }
      );
    }

    const response = await handler(request, context);

    // Add rate limit headers to successful responses
    const newResponse = new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers),
    });
    newResponse.headers.set("X-RateLimit-Remaining", String(result.remaining));
    newResponse.headers.set("X-RateLimit-Reset", String(result.reset));

    return newResponse;
  };
}
