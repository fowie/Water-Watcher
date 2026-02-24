import { NextResponse } from "next/server";

/**
 * Return a JSON error response with the given status code and message.
 */
export function apiError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Catch-all error handler that logs the error and returns a safe 500 response.
 * Never leaks stack traces or internal details to the client.
 */
export function handleApiError(error: unknown) {
  console.error("API error:", error);
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}
