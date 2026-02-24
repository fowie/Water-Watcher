/**
 * Tests for the API error helper utilities.
 *
 * Tests:
 * - apiError returns correct status and message
 * - handleApiError returns 500 with safe message
 * - handleApiError doesn't leak stack traces or internal details
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiError, handleApiError } from "@/lib/api-errors";

describe("apiError", () => {
  it("returns JSON response with the given status and message", async () => {
    const res = apiError(404, "Not found");
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Not found");
  });

  it("returns 400 for bad request", async () => {
    const res = apiError(400, "Invalid input");
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid input");
  });

  it("returns 403 for forbidden", async () => {
    const res = apiError(403, "Not authorized");
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("Not authorized");
  });

  it("returns 503 for service unavailable", async () => {
    const res = apiError(503, "Service unavailable");
    const data = await res.json();

    expect(res.status).toBe(503);
    expect(data.error).toBe("Service unavailable");
  });

  it("response body contains only the error key", async () => {
    const res = apiError(422, "Validation failed");
    const data = await res.json();

    expect(Object.keys(data)).toEqual(["error"]);
  });

  it("returns proper content-type header", () => {
    const res = apiError(404, "Not found");

    expect(res.headers.get("content-type")).toContain("application/json");
  });
});

describe("handleApiError", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns 500 with safe message", async () => {
    const res = handleApiError(new Error("DB connection failed"));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });

  it("does not leak stack traces in response", async () => {
    const err = new Error("secret database password in connection string");
    err.stack = "Error: secret database password\n    at Object.<anonymous> (/app/src/db.ts:15:11)";

    const res = handleApiError(err);
    const text = JSON.stringify(await res.json());

    expect(text).not.toContain("secret");
    expect(text).not.toContain("stack");
    expect(text).not.toContain("/app/src");
    expect(text).not.toContain("db.ts");
  });

  it("does not leak error message in response", async () => {
    const res = handleApiError(new Error("ECONNREFUSED 127.0.0.1:5432"));
    const data = await res.json();

    expect(data.error).toBe("Internal server error");
    expect(JSON.stringify(data)).not.toContain("ECONNREFUSED");
    expect(JSON.stringify(data)).not.toContain("5432");
  });

  it("logs the original error to console.error", () => {
    const err = new Error("Something broke");
    handleApiError(err);

    expect(console.error).toHaveBeenCalledWith("API error:", err);
  });

  it("handles non-Error objects gracefully", async () => {
    const res = handleApiError("string error");
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });

  it("handles null/undefined gracefully", async () => {
    const res1 = handleApiError(null);
    expect(res1.status).toBe(500);

    const res2 = handleApiError(undefined);
    expect(res2.status).toBe(500);
  });

  it("response body contains only the error key", async () => {
    const res = handleApiError(new Error("fail"));
    const data = await res.json();

    expect(Object.keys(data)).toEqual(["error"]);
  });
});
