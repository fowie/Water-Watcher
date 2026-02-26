/**
 * Tests for ETag caching middleware (web/src/lib/etag.ts).
 *
 * Tests:
 * - withETag wraps a handler and returns ETag header on 200 responses
 * - If-None-Match matching ETag returns 304 with no body
 * - Non-matching If-None-Match returns 200 + new ETag
 * - Cache-Control header is set on public endpoints
 * - ETag changes when response data changes
 * - Non-200 responses pass through without ETag headers
 * - Authenticated endpoints should not get public cache headers (tested via auth wrapper)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

import { withETag } from "@/lib/etag";

function mockRequest(
  url = "http://localhost:3000/api/rivers",
  headers: Record<string, string> = {}
): Request {
  return new Request(url, { headers });
}

describe("withETag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── ETag on Successful Response ──────────────────────

  it("adds ETag header on 200 response", async () => {
    const handler = vi.fn().mockResolvedValue(
      NextResponse.json({ rivers: [{ id: "1", name: "Colorado" }], total: 1 })
    );

    const wrapped = withETag(handler);
    const res = await wrapped(mockRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBeTruthy();
    expect(res.headers.get("ETag")).toMatch(/^W\/"[a-f0-9]+"/);
  });

  it("adds Cache-Control header on 200 response", async () => {
    const handler = vi.fn().mockResolvedValue(
      NextResponse.json({ data: "test" })
    );

    const wrapped = withETag(handler);
    const res = await wrapped(mockRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=60, stale-while-revalidate=300"
    );
  });

  it("preserves original response body", async () => {
    const payload = { rivers: [{ id: "1" }], total: 1 };
    const handler = vi.fn().mockResolvedValue(NextResponse.json(payload));

    const wrapped = withETag(handler);
    const res = await wrapped(mockRequest());
    const data = await res.json();

    expect(data).toEqual(payload);
  });

  // ─── If-None-Match → 304 ─────────────────────────────

  it("returns 304 when If-None-Match matches current ETag", async () => {
    const payload = { rivers: [{ id: "1" }] };
    const handler = vi.fn()
      .mockResolvedValueOnce(NextResponse.json(payload))
      .mockResolvedValueOnce(NextResponse.json(payload));
    const wrapped = withETag(handler);

    // First request — get the ETag
    const firstRes = await wrapped(mockRequest());
    const etag = firstRes.headers.get("ETag")!;
    expect(etag).toBeTruthy();

    // Second request with matching If-None-Match
    const secondRes = await wrapped(
      mockRequest("http://localhost:3000/api/rivers", {
        "if-none-match": etag,
      })
    );

    expect(secondRes.status).toBe(304);
  });

  it("returns no body on 304 response", async () => {
    const payload = { test: true };
    const handler = vi.fn()
      .mockResolvedValueOnce(NextResponse.json(payload))
      .mockResolvedValueOnce(NextResponse.json(payload));
    const wrapped = withETag(handler);

    const firstRes = await wrapped(mockRequest());
    const etag = firstRes.headers.get("ETag")!;

    const secondRes = await wrapped(
      mockRequest("http://localhost:3000/api/rivers", {
        "if-none-match": etag,
      })
    );

    expect(secondRes.status).toBe(304);
    const body = await secondRes.text();
    expect(body).toBe("");
  });

  it("includes ETag and Cache-Control on 304 response", async () => {
    const handler = vi.fn()
      .mockResolvedValueOnce(NextResponse.json({ ok: true }))
      .mockResolvedValueOnce(NextResponse.json({ ok: true }));
    const wrapped = withETag(handler);

    const firstRes = await wrapped(mockRequest());
    const etag = firstRes.headers.get("ETag")!;

    const secondRes = await wrapped(
      mockRequest("http://localhost:3000/api/rivers", {
        "if-none-match": etag,
      })
    );

    expect(secondRes.headers.get("ETag")).toBe(etag);
    expect(secondRes.headers.get("Cache-Control")).toBe(
      "public, max-age=60, stale-while-revalidate=300"
    );
  });

  // ─── Non-matching If-None-Match → 200 ────────────────

  it("returns 200 with new ETag when If-None-Match does not match", async () => {
    const handler = vi.fn().mockResolvedValue(
      NextResponse.json({ rivers: [] })
    );
    const wrapped = withETag(handler);

    const res = await wrapped(
      mockRequest("http://localhost:3000/api/rivers", {
        "if-none-match": 'W/"stale-etag-value"',
      })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBeTruthy();
    expect(res.headers.get("ETag")).not.toBe('W/"stale-etag-value"');
  });

  // ─── ETag Changes When Data Changes ──────────────────

  it("produces different ETags for different response data", async () => {
    const wrapped1 = withETag(
      vi.fn().mockResolvedValue(NextResponse.json({ data: "version-1" }))
    );
    const wrapped2 = withETag(
      vi.fn().mockResolvedValue(NextResponse.json({ data: "version-2" }))
    );

    const res1 = await wrapped1(mockRequest());
    const res2 = await wrapped2(mockRequest());

    const etag1 = res1.headers.get("ETag");
    const etag2 = res2.headers.get("ETag");

    expect(etag1).toBeTruthy();
    expect(etag2).toBeTruthy();
    expect(etag1).not.toBe(etag2);
  });

  it("produces identical ETags for identical response data", async () => {
    const payload = { rivers: [{ id: "r1" }] };
    const handler = vi.fn()
      .mockResolvedValueOnce(NextResponse.json(payload))
      .mockResolvedValueOnce(NextResponse.json(payload));
    const wrapped = withETag(handler);

    const res1 = await wrapped(mockRequest());
    const res2 = await wrapped(mockRequest());

    expect(res1.headers.get("ETag")).toBe(res2.headers.get("ETag"));
  });

  // ─── Non-200 Responses Pass Through ──────────────────

  it("does not add ETag to 404 responses", async () => {
    const handler = vi.fn().mockResolvedValue(
      NextResponse.json({ error: "Not found" }, { status: 404 })
    );
    const wrapped = withETag(handler);
    const res = await wrapped(mockRequest());

    expect(res.status).toBe(404);
    expect(res.headers.get("ETag")).toBeNull();
  });

  it("does not add ETag to 500 responses", async () => {
    const handler = vi.fn().mockResolvedValue(
      NextResponse.json({ error: "Server error" }, { status: 500 })
    );
    const wrapped = withETag(handler);
    const res = await wrapped(mockRequest());

    expect(res.status).toBe(500);
    expect(res.headers.get("ETag")).toBeNull();
  });

  it("does not add ETag to 401 responses", async () => {
    const handler = vi.fn().mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const wrapped = withETag(handler);
    const res = await wrapped(mockRequest());

    expect(res.status).toBe(401);
    expect(res.headers.get("ETag")).toBeNull();
  });

  it("does not add Cache-Control to non-200 responses", async () => {
    const handler = vi.fn().mockResolvedValue(
      NextResponse.json({ error: "Bad request" }, { status: 400 })
    );
    const wrapped = withETag(handler);
    const res = await wrapped(mockRequest());

    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBeNull();
  });

  // ─── Handler Invocation ───────────────────────────────

  it("still calls the handler even when If-None-Match is present", async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: 1 }));
    const wrapped = withETag(handler);

    await wrapped(
      mockRequest("http://localhost:3000/api/rivers", {
        "if-none-match": 'W/"some-hash"',
      })
    );

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("passes context parameter to handler", async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: 1 }));
    const wrapped = withETag(handler);

    const ctx = { params: { id: "river-1" } };
    await wrapped(mockRequest(), ctx);

    expect(handler).toHaveBeenCalledWith(expect.any(Request), ctx);
  });

  // ─── Weak ETag Format ────────────────────────────────

  it("produces weak ETags (W/ prefix)", async () => {
    const handler = vi.fn().mockResolvedValue(NextResponse.json({ x: 1 }));
    const wrapped = withETag(handler);
    const res = await wrapped(mockRequest());

    const etag = res.headers.get("ETag")!;
    expect(etag.startsWith('W/"')).toBe(true);
    expect(etag.endsWith('"')).toBe(true);
  });

  // ─── Authenticated Endpoints (no public caching) ─────

  it("does not apply public Cache-Control to auth-guarded handlers returning errors", async () => {
    // When a withAuth-wrapped handler returns 401, withETag
    // should NOT add cache headers since status !== 200
    const authHandler = vi.fn().mockResolvedValue(
      NextResponse.json({ error: "Authentication required" }, { status: 401 })
    );
    const wrapped = withETag(authHandler);
    const res = await wrapped(mockRequest());

    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toBeNull();
    expect(res.headers.get("ETag")).toBeNull();
  });

  // ─── Preserves Original Headers ───────────────────────

  it("preserves original response headers alongside ETag", async () => {
    const response = NextResponse.json({ data: 1 });
    response.headers.set("X-Custom-Header", "custom-value");
    const handler = vi.fn().mockResolvedValue(response);

    const wrapped = withETag(handler);
    const res = await wrapped(mockRequest());

    expect(res.headers.get("X-Custom-Header")).toBe("custom-value");
    expect(res.headers.get("ETag")).toBeTruthy();
  });
});
