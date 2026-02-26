import { NextResponse } from "next/server";
import { createHash } from "crypto";

/**
 * Compute an ETag from a JSON response body using MD5.
 * Returns a weak ETag (W/"...") since JSON serialization may vary.
 */
function computeETag(body: string): string {
  const hash = createHash("md5").update(body).digest("hex");
  return `W/"${hash}"`;
}

/**
 * Higher-order function that adds ETag support to a GET route handler.
 *
 * - Computes an ETag from the JSON response body
 * - Checks `If-None-Match` request header — returns 304 if matches
 * - Sets `Cache-Control: public, max-age=60, stale-while-revalidate=300`
 * - Only applies to responses with status 200
 *
 * Usage:
 *   export const GET = withETag(async (request) => {
 *     const data = await fetchData();
 *     return NextResponse.json(data);
 *   });
 */
export function withETag(
  handler: (request: Request, context?: unknown) => Promise<Response | NextResponse>
): (request: Request, context?: unknown) => Promise<Response | NextResponse> {
  return async (request: Request, context?: unknown) => {
    const response = await handler(request, context);

    // Only apply ETag to successful JSON responses
    if (response.status !== 200) {
      return response;
    }

    // Read the response body
    const body = await response.text();
    const etag = computeETag(body);

    // Check If-None-Match header
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      });
    }

    // Return the response with ETag and Cache-Control headers
    const newResponse = new NextResponse(body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers),
    });
    newResponse.headers.set("ETag", etag);
    newResponse.headers.set(
      "Cache-Control",
      "public, max-age=60, stale-while-revalidate=300"
    );

    return newResponse;
  };
}
