/**
 * Tests for the client-side API functions in lib/api.ts.
 *
 * Mocks `fetch` and verifies correct URLs, methods, headers,
 * error handling, and query parameter encoding.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch globally before importing api module
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  getRivers,
  getRiver,
  createRiver,
  deleteRiver,
  updateRiver,
  getDeals,
  getDealFilters,
  createDealFilter,
  updateDealFilter,
  getHealth,
  subscribePush,
} from "@/lib/api";

// ─── Helpers ──────────────────────────────────────────────

function mockJsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

function mockErrorResponse(status: number, body?: unknown) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => (body ? Promise.resolve(body) : Promise.reject(new Error("no body"))),
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

// ─── getRivers ────────────────────────────────────────────

describe("getRivers", () => {
  it("calls GET /api/rivers with no params", async () => {
    mockFetch.mockReturnValueOnce(
      mockJsonResponse({ rivers: [], total: 0, limit: 20, offset: 0 })
    );
    await getRivers();
    expect(mockFetch).toHaveBeenCalledOnce();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe("/api/rivers");
  });

  it("passes search param", async () => {
    mockFetch.mockReturnValueOnce(
      mockJsonResponse({ rivers: [], total: 0, limit: 20, offset: 0 })
    );
    await getRivers({ search: "Colorado" });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("search=Colorado");
  });

  it("passes state param", async () => {
    mockFetch.mockReturnValueOnce(
      mockJsonResponse({ rivers: [], total: 0, limit: 20, offset: 0 })
    );
    await getRivers({ state: "CO" });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("state=CO");
  });

  it("passes limit and offset", async () => {
    mockFetch.mockReturnValueOnce(
      mockJsonResponse({ rivers: [], total: 0, limit: 10, offset: 5 })
    );
    await getRivers({ limit: 10, offset: 5 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("limit=10");
    expect(url).toContain("offset=5");
  });

  it("sends Content-Type header", async () => {
    mockFetch.mockReturnValueOnce(
      mockJsonResponse({ rivers: [], total: 0, limit: 20, offset: 0 })
    );
    await getRivers();
    const init = mockFetch.mock.calls[0][1];
    expect(init?.headers?.["Content-Type"]).toBe("application/json");
  });

  it("throws on non-200 response", async () => {
    mockFetch.mockReturnValueOnce(
      mockErrorResponse(500, { error: "Internal server error" })
    );
    await expect(getRivers()).rejects.toThrow("Internal server error");
  });

  it("encodes special characters in search", async () => {
    mockFetch.mockReturnValueOnce(
      mockJsonResponse({ rivers: [], total: 0, limit: 20, offset: 0 })
    );
    await getRivers({ search: "río grande" });
    const url = mockFetch.mock.calls[0][0] as string;
    // URLSearchParams encodes spaces and special chars
    expect(url).toContain("search=");
    expect(url).not.toContain(" ");
  });
});

// ─── getRiver ─────────────────────────────────────────────

describe("getRiver", () => {
  it("calls GET /api/rivers/:id", async () => {
    mockFetch.mockReturnValueOnce(
      mockJsonResponse({ id: "r1", name: "Test River" })
    );
    await getRiver("r1");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe("/api/rivers/r1");
  });

  it("throws on 404", async () => {
    mockFetch.mockReturnValueOnce(
      mockErrorResponse(404, { error: "River not found" })
    );
    await expect(getRiver("nonexistent")).rejects.toThrow("River not found");
  });
});

// ─── createRiver ──────────────────────────────────────────

describe("createRiver", () => {
  it("calls POST /api/rivers with body", async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse({ id: "new-river" }));
    await createRiver({ name: "New River", state: "WV" });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/rivers");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ name: "New River", state: "WV" });
  });

  it("sends Content-Type header", async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse({ id: "new-river" }));
    await createRiver({ name: "Test", state: "CO" });
    const init = mockFetch.mock.calls[0][1];
    expect(init.headers["Content-Type"]).toBe("application/json");
  });
});

// ─── updateRiver ──────────────────────────────────────────

describe("updateRiver", () => {
  it("calls PATCH /api/rivers/:id with body", async () => {
    mockFetch.mockReturnValueOnce(
      mockJsonResponse({ id: "r1", name: "Updated" })
    );
    await updateRiver("r1", { name: "Updated" });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/rivers/r1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ name: "Updated" });
  });

  it("sends partial update fields only", async () => {
    mockFetch.mockReturnValueOnce(
      mockJsonResponse({ id: "r1", state: "WA" })
    );
    await updateRiver("r1", { state: "WA" });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({ state: "WA" });
    expect(body.name).toBeUndefined();
  });

  it("throws on network failure", async () => {
    mockFetch.mockReturnValueOnce(
      mockErrorResponse(500, { error: "DB error" })
    );
    await expect(updateRiver("r1", { name: "Fail" })).rejects.toThrow();
  });

  it("handles nullable fields", async () => {
    mockFetch.mockReturnValueOnce(
      mockJsonResponse({ id: "r1", region: null })
    );
    await updateRiver("r1", { region: null });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.region).toBeNull();
  });
});

// ─── deleteRiver ──────────────────────────────────────────

describe("deleteRiver", () => {
  it("calls DELETE /api/rivers/:id", async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve({}) })
    );
    await deleteRiver("r1");
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/rivers/r1");
    expect(init.method).toBe("DELETE");
  });

  it("does not send Content-Type header", async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve({}) })
    );
    await deleteRiver("r1");
    const init = mockFetch.mock.calls[0][1];
    // deleteRiver uses raw fetch without the fetcher helper
    expect(init?.headers).toBeUndefined();
  });

  it("throws on 404", async () => {
    mockFetch.mockReturnValueOnce(
      mockErrorResponse(404, { error: "River not found" })
    );
    await expect(deleteRiver("nonexistent")).rejects.toThrow("River not found");
  });

  it("throws on 500", async () => {
    mockFetch.mockReturnValueOnce(
      mockErrorResponse(500, { error: "Server error" })
    );
    await expect(deleteRiver("r1")).rejects.toThrow("Server error");
  });

  it("handles missing error body gracefully", async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("no JSON")),
      })
    );
    await expect(deleteRiver("r1")).rejects.toThrow("Delete failed: 500");
  });
});

// ─── getDeals ─────────────────────────────────────────────

describe("getDeals", () => {
  it("calls GET /api/deals with no params", async () => {
    mockFetch.mockReturnValueOnce(
      mockJsonResponse({ deals: [], total: 0, limit: 20, offset: 0 })
    );
    await getDeals();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe("/api/deals");
  });

  it("passes category and maxPrice", async () => {
    mockFetch.mockReturnValueOnce(
      mockJsonResponse({ deals: [], total: 0, limit: 20, offset: 0 })
    );
    await getDeals({ category: "kayak", maxPrice: 500 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("category=kayak");
    expect(url).toContain("maxPrice=500");
  });

  it("passes region param", async () => {
    mockFetch.mockReturnValueOnce(
      mockJsonResponse({ deals: [], total: 0, limit: 20, offset: 0 })
    );
    await getDeals({ region: "portland" });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("region=portland");
  });
});

// ─── getDealFilters ───────────────────────────────────────

describe("getDealFilters", () => {
  it("calls GET /api/deals/filters with userId", async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse([]));
    await getDealFilters("user-1");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/deals/filters");
    expect(url).toContain("userId=user-1");
  });

  it("encodes userId with special characters", async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse([]));
    await getDealFilters("user@domain.com");
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("userId=user%40domain.com");
  });
});

// ─── createDealFilter ─────────────────────────────────────

describe("createDealFilter", () => {
  it("calls POST /api/deals/filters with userId and data", async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse({ id: "f1" }));
    await createDealFilter("user-1", {
      name: "Raft deals",
      keywords: ["raft"],
    });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/deals/filters");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.userId).toBe("user-1");
    expect(body.name).toBe("Raft deals");
    expect(body.keywords).toEqual(["raft"]);
  });
});

// ─── updateDealFilter ─────────────────────────────────────

describe("updateDealFilter", () => {
  it("calls PATCH /api/deals/filters/:id with userId and data", async () => {
    mockFetch.mockReturnValueOnce(
      mockJsonResponse({ id: "f1", name: "Updated" })
    );
    await updateDealFilter("f1", "user-1", { name: "Updated" });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/deals/filters/f1");
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(init.body);
    expect(body.userId).toBe("user-1");
    expect(body.name).toBe("Updated");
  });

  it("merges userId into body", async () => {
    mockFetch.mockReturnValueOnce(
      mockJsonResponse({ id: "f1", maxPrice: null })
    );
    await updateDealFilter("f1", "user-1", { maxPrice: null });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.userId).toBe("user-1");
    expect(body.maxPrice).toBeNull();
  });

  it("throws on 403 (not owner)", async () => {
    mockFetch.mockReturnValueOnce(
      mockErrorResponse(403, { error: "Not authorized" })
    );
    await expect(
      updateDealFilter("f1", "wrong-user", { name: "Hack" })
    ).rejects.toThrow("Not authorized");
  });
});

// ─── getHealth ────────────────────────────────────────────

describe("getHealth", () => {
  it("calls GET /api/health", async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ status: "ok", timestamp: "2026-01-01", version: "1.0.0" }),
      })
    );
    const health = await getHealth();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toBe("/api/health");
    expect(health.status).toBe("ok");
  });

  it("returns degraded status", async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ status: "degraded", timestamp: "2026-01-01", version: "1.0.0" }),
      })
    );
    const health = await getHealth();
    expect(health.status).toBe("degraded");
  });

  it("does not use fetcher helper (no Content-Type header)", async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ status: "ok", timestamp: "2026-01-01", version: "1.0.0" }),
      })
    );
    await getHealth();
    const init = mockFetch.mock.calls[0][1];
    // getHealth uses raw fetch, not the fetcher helper
    expect(init).toBeUndefined();
  });
});

// ─── subscribePush ────────────────────────────────────────

describe("subscribePush", () => {
  it("calls POST /api/notifications/subscribe", async () => {
    mockFetch.mockReturnValueOnce(mockJsonResponse({ success: true }));
    await subscribePush("user-1", {
      endpoint: "https://fcm.googleapis.com/fcm/send/abc",
      keys: { p256dh: "key1", auth: "key2" },
    } as PushSubscriptionJSON);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/notifications/subscribe");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    expect(body.userId).toBe("user-1");
    expect(body.subscription.endpoint).toContain("fcm.googleapis.com");
  });
});

// ─── Error Handling ───────────────────────────────────────

describe("Error handling", () => {
  it("extracts error message from response body", async () => {
    mockFetch.mockReturnValueOnce(
      mockErrorResponse(400, { error: "Validation failed" })
    );
    await expect(getRiver("r1")).rejects.toThrow("Validation failed");
  });

  it("falls back to status code when no error field", async () => {
    mockFetch.mockReturnValueOnce(
      mockErrorResponse(502, { message: "Bad Gateway" })
    );
    await expect(getRiver("r1")).rejects.toThrow("Request failed: 502");
  });

  it("handles network error", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(getRiver("r1")).rejects.toThrow("Failed to fetch");
  });

  it("handles JSON parse failure on error response", async () => {
    mockFetch.mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      })
    );
    // Should still throw with status-based fallback
    await expect(getRiver("r1")).rejects.toThrow("Request failed: 500");
  });
});
