/**
 * Tests for the withAuth API middleware (web/src/lib/api-middleware.ts).
 *
 * Tests:
 * - Returns 401 when no session exists
 * - Returns 401 when session has no user ID
 * - Passes request through to handler with x-user-id header when authenticated
 * - Preserves original request properties (method, URL, headers, body)
 * - Handler receives the context parameter
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

import { withAuth } from "@/lib/api-middleware";

function mockRequest(
  url = "http://localhost/api/test",
  options: RequestInit = {}
): Request {
  return new Request(url, options);
}

describe("withAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Unauthenticated → 401 ────────────────────────────

  it("returns 401 when session is null", async () => {
    mockAuth.mockResolvedValue(null);

    const handler = vi.fn();
    const wrapped = withAuth(handler);
    const res = await wrapped(mockRequest());
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain("Authentication required");
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 when session has no user", async () => {
    mockAuth.mockResolvedValue({ user: undefined });

    const handler = vi.fn();
    const wrapped = withAuth(handler);
    const res = await wrapped(mockRequest());

    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 when session user has no id", async () => {
    mockAuth.mockResolvedValue({ user: { name: "No ID", email: "a@b.com" } });

    const handler = vi.fn();
    const wrapped = withAuth(handler);
    const res = await wrapped(mockRequest());

    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 when session user id is empty string", async () => {
    mockAuth.mockResolvedValue({ user: { id: "", name: "Empty" } });

    const handler = vi.fn();
    const wrapped = withAuth(handler);
    const res = await wrapped(mockRequest());

    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("401 response has correct JSON content-type", async () => {
    mockAuth.mockResolvedValue(null);

    const wrapped = withAuth(vi.fn());
    const res = await wrapped(mockRequest());

    expect(res.headers.get("content-type")).toContain("application/json");
  });

  // ─── Authenticated → passes through ──────────────────

  it("calls handler when session has valid user id", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-42", name: "River Guide", email: "guide@river.com" },
    });

    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const wrapped = withAuth(handler);

    await wrapped(mockRequest());

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("injects x-user-id header into the request passed to handler", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-42" },
    });

    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const wrapped = withAuth(handler);

    await wrapped(mockRequest());

    const passedRequest: Request = handler.mock.calls[0][0];
    expect(passedRequest.headers.get("x-user-id")).toBe("user-42");
  });

  it("preserves original request URL", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const wrapped = withAuth(handler);
    const originalUrl = "http://localhost/api/rivers?search=colorado";

    await wrapped(mockRequest(originalUrl));

    const passedRequest: Request = handler.mock.calls[0][0];
    expect(passedRequest.url).toBe(originalUrl);
  });

  it("preserves original request method", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const wrapped = withAuth(handler);

    await wrapped(mockRequest("http://localhost/api/test", { method: "DELETE" }));

    const passedRequest: Request = handler.mock.calls[0][0];
    expect(passedRequest.method).toBe("DELETE");
  });

  it("preserves original request headers", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const wrapped = withAuth(handler);

    const req = mockRequest("http://localhost/api/test", {
      headers: { "X-Custom-Header": "custom-value" },
    });

    await wrapped(req);

    const passedRequest: Request = handler.mock.calls[0][0];
    expect(passedRequest.headers.get("x-custom-header")).toBe("custom-value");
  });

  it("returns the handler's response", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const handlerResponse = new Response(JSON.stringify({ data: "test" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    const handler = vi.fn().mockResolvedValue(handlerResponse);
    const wrapped = withAuth(handler);

    const res = await wrapped(mockRequest());

    expect(res).toBe(handlerResponse);
  });

  it("passes context parameter through to handler", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const wrapped = withAuth(handler);
    const context = { params: { id: "river-1" } };

    await wrapped(mockRequest(), context);

    expect(handler.mock.calls[0][1]).toBe(context);
  });

  // ─── Edge cases ───────────────────────────────────────

  it("does not modify the original request object", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const wrapped = withAuth(handler);
    const originalReq = mockRequest();

    await wrapped(originalReq);

    // Original request should NOT have the x-user-id header
    expect(originalReq.headers.get("x-user-id")).toBeNull();
  });

  it("handles POST request with JSON body", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const handler = vi.fn().mockResolvedValue(new Response("ok"));
    const wrapped = withAuth(handler);

    const req = mockRequest("http://localhost/api/rivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Colorado River" }),
    });

    await wrapped(req);

    expect(handler).toHaveBeenCalledTimes(1);
    const passedRequest: Request = handler.mock.calls[0][0];
    expect(passedRequest.method).toBe("POST");
  });

  it("wraps an async handler correctly", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });

    const handler = vi.fn().mockImplementation(async () => {
      // Simulate async work
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response(JSON.stringify({ success: true }));
    });

    const wrapped = withAuth(handler);
    const res = await wrapped(mockRequest());
    const data = await res.json();

    expect(data.success).toBe(true);
  });
});
