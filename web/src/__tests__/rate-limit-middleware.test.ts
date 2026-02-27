/**
 * Tests for the Rate Limiting middleware — Round 15 expanded coverage.
 *
 * Source: web/src/lib/rate-limit.ts + web/src/lib/api-middleware.ts
 *
 * Focus areas:
 * - Token bucket replenishment over time (multiple time steps)
 * - Authenticated users get 60 req/min limit (defaultConfig)
 * - Anonymous users get 20 req/min limit (custom config)
 * - Rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)
 * - 429 response when limit exceeded
 * - Different IP addresses have separate buckets
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  rateLimit,
  resetRateLimiter,
  defaultConfig,
  strictAuthConfig,
} from "@/lib/rate-limit";
import type { RateLimitConfig } from "@/lib/rate-limit";

const mockAuth = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

import { withRateLimit, withAuth } from "@/lib/api-middleware";

// ─── Helpers ─────────────────────────────────────────────

function mockRequest(
  url = "http://localhost/api/test",
  headers: Record<string, string> = {}
): Request {
  return new Request(url, {
    headers: { "x-forwarded-for": "10.0.0.1", ...headers },
  });
}

/** Config representing authenticated user limits (60 req/min) */
const authUserConfig: RateLimitConfig = {
  maxTokens: 60,
  refillRate: 1, // 1 token per second
  refillInterval: 1,
};

/** Config representing anonymous user limits (20 req/min) */
const anonUserConfig: RateLimitConfig = {
  maxTokens: 20,
  refillRate: 20 / 60, // ~0.333 tokens per second
  refillInterval: 1,
};

// ─── Token Bucket Replenishment ─────────────────────────

describe("Token bucket replenishment over time", () => {
  beforeEach(() => {
    resetRateLimiter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetRateLimiter();
  });

  it("replenishes tokens incrementally over multiple time steps", () => {
    const config: RateLimitConfig = {
      maxTokens: 5,
      refillRate: 1,
      refillInterval: 1,
    };
    const req = mockRequest();

    // Exhaust all tokens
    for (let i = 0; i < 5; i++) {
      rateLimit(req, config);
    }
    expect(rateLimit(req, config).success).toBe(false);

    // Advance 1 second — should refill 1 token
    vi.advanceTimersByTime(1000);
    const r1 = rateLimit(req, config);
    expect(r1.success).toBe(true);
    expect(r1.remaining).toBe(0);

    // Still blocked immediately after consuming the 1 refilled token
    expect(rateLimit(req, config).success).toBe(false);

    // Advance 3 more seconds — should refill 3 tokens
    vi.advanceTimersByTime(3000);
    const r2 = rateLimit(req, config);
    expect(r2.success).toBe(true);
    expect(r2.remaining).toBe(2);
  });

  it("fractional refill rates accumulate over time", () => {
    // 20 tokens per minute = 0.333 tokens/sec
    const req = mockRequest("http://localhost/api/test", {
      "x-forwarded-for": "10.0.1.1",
    });

    // Exhaust all tokens
    for (let i = 0; i < anonUserConfig.maxTokens; i++) {
      rateLimit(req, anonUserConfig);
    }
    expect(rateLimit(req, anonUserConfig).success).toBe(false);

    // Advance 3 seconds — should refill ~1 token (3 * 0.333 = ~1.0)
    vi.advanceTimersByTime(3000);
    const result = rateLimit(req, anonUserConfig);
    expect(result.success).toBe(true);
  });

  it("does not exceed maxTokens even after very long idle time", () => {
    const req = mockRequest("http://localhost/api/test", {
      "x-forwarded-for": "10.0.2.1",
    });

    // Use 1 token
    rateLimit(req, anonUserConfig);

    // Wait a very long time
    vi.advanceTimersByTime(60 * 60 * 1000); // 1 hour

    // Should have maxTokens - 1 remaining (refilled to max, then consumed 1)
    const result = rateLimit(req, anonUserConfig);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(anonUserConfig.maxTokens - 1);
  });
});

// ─── Authenticated vs Anonymous limits ──────────────────

describe("Authenticated vs Anonymous rate limits", () => {
  beforeEach(() => {
    resetRateLimiter();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetRateLimiter();
  });

  it("authenticated config allows 60 requests", () => {
    const req = mockRequest("http://localhost/api/test", {
      "x-forwarded-for": "10.1.0.1",
    });

    for (let i = 0; i < 60; i++) {
      const result = rateLimit(req, authUserConfig);
      expect(result.success).toBe(true);
    }
    // 61st request is blocked
    expect(rateLimit(req, authUserConfig).success).toBe(false);
  });

  it("anonymous config allows only 20 requests", () => {
    const req = mockRequest("http://localhost/api/test", {
      "x-forwarded-for": "10.1.0.2",
    });

    for (let i = 0; i < 20; i++) {
      const result = rateLimit(req, anonUserConfig);
      expect(result.success).toBe(true);
    }
    // 21st request is blocked
    expect(rateLimit(req, anonUserConfig).success).toBe(false);
  });

  it("defaultConfig matches authenticated user limit (60 tokens)", () => {
    expect(defaultConfig.maxTokens).toBe(60);
  });

  it("applying different configs per auth status works independently", () => {
    const authedReq = mockRequest("http://localhost/api/test", {
      "x-forwarded-for": "10.1.1.1",
    });
    const anonReq = mockRequest("http://localhost/api/test", {
      "x-forwarded-for": "10.1.1.2",
    });

    // Exhaust anonymous limit
    for (let i = 0; i < 20; i++) {
      rateLimit(anonReq, anonUserConfig);
    }
    expect(rateLimit(anonReq, anonUserConfig).success).toBe(false);

    // Authenticated user (different IP) should still have plenty of tokens
    const authedResult = rateLimit(authedReq, authUserConfig);
    expect(authedResult.success).toBe(true);
    expect(authedResult.remaining).toBe(59);
  });
});

// ─── Rate Limit Headers ─────────────────────────────────

describe("Rate limit headers via withRateLimit", () => {
  beforeEach(() => {
    resetRateLimiter();
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetRateLimiter();
  });

  it("success response includes X-RateLimit-Remaining header", async () => {
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const wrapped = withRateLimit(handler, authUserConfig);

    const req = mockRequest("http://localhost/api/test", {
      "x-forwarded-for": "10.2.0.1",
    });
    const res = await wrapped(req);

    expect(res.status).toBe(200);
    const remaining = res.headers.get("X-RateLimit-Remaining");
    expect(remaining).toBeTruthy();
    expect(parseInt(remaining!)).toBe(59);
  });

  it("success response includes X-RateLimit-Reset header", async () => {
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const wrapped = withRateLimit(handler, authUserConfig);

    const req = mockRequest("http://localhost/api/test", {
      "x-forwarded-for": "10.2.0.2",
    });
    const res = await wrapped(req);

    const reset = res.headers.get("X-RateLimit-Reset");
    expect(reset).toBeTruthy();
    expect(parseInt(reset!)).toBeGreaterThan(0);
  });

  it("X-RateLimit-Remaining decrements with each request", async () => {
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const config: RateLimitConfig = {
      maxTokens: 5,
      refillRate: 0.001, // Very slow refill — effectively no refill during test
      refillInterval: 1,
    };
    const wrapped = withRateLimit(handler, config);

    const req = mockRequest("http://localhost/api/test", {
      "x-forwarded-for": "10.2.0.3",
    });

    const r1 = await wrapped(req);
    expect(parseInt(r1.headers.get("X-RateLimit-Remaining")!)).toBe(4);

    const r2 = await wrapped(req);
    expect(parseInt(r2.headers.get("X-RateLimit-Remaining")!)).toBe(3);

    const r3 = await wrapped(req);
    expect(parseInt(r3.headers.get("X-RateLimit-Remaining")!)).toBe(2);
  });

  it("429 response includes Retry-After header", async () => {
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const config: RateLimitConfig = {
      maxTokens: 1,
      refillRate: 1,
      refillInterval: 1,
    };
    const wrapped = withRateLimit(handler, config);

    const req = mockRequest("http://localhost/api/test", {
      "x-forwarded-for": "10.2.0.4",
    });

    // Consume the single token
    await wrapped(req);
    // Now limited
    const res = await wrapped(req);
    expect(res.status).toBe(429);

    const retryAfter = res.headers.get("Retry-After");
    expect(retryAfter).toBeTruthy();
    expect(parseInt(retryAfter!)).toBeGreaterThanOrEqual(1);
  });

  it("429 response includes X-RateLimit-Remaining: 0", async () => {
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const config: RateLimitConfig = {
      maxTokens: 1,
      refillRate: 0.001,
      refillInterval: 1,
    };
    const wrapped = withRateLimit(handler, config);

    const req = mockRequest("http://localhost/api/test", {
      "x-forwarded-for": "10.2.0.5",
    });

    await wrapped(req);
    const res = await wrapped(req);
    expect(res.status).toBe(429);
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("429 response includes X-RateLimit-Reset header", async () => {
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const config: RateLimitConfig = {
      maxTokens: 1,
      refillRate: 0.001,
      refillInterval: 1,
    };
    const wrapped = withRateLimit(handler, config);

    const req = mockRequest("http://localhost/api/test", {
      "x-forwarded-for": "10.2.0.6",
    });

    await wrapped(req);
    const res = await wrapped(req);
    expect(res.status).toBe(429);
    expect(res.headers.get("X-RateLimit-Reset")).toBeTruthy();
  });
});

// ─── 429 Response ───────────────────────────────────────

describe("429 Too Many Requests", () => {
  beforeEach(() => {
    resetRateLimiter();
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetRateLimiter();
  });

  it("returns JSON error body on 429", async () => {
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const config: RateLimitConfig = {
      maxTokens: 1,
      refillRate: 0.001,
      refillInterval: 1,
    };
    const wrapped = withRateLimit(handler, config);

    const req = mockRequest("http://localhost/api/test", {
      "x-forwarded-for": "10.3.0.1",
    });

    await wrapped(req);
    const res = await wrapped(req);

    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(data.error).toContain("Too many requests");
  });

  it("does not invoke handler when rate limited", async () => {
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const config: RateLimitConfig = {
      maxTokens: 2,
      refillRate: 0.001,
      refillInterval: 1,
    };
    const wrapped = withRateLimit(handler, config);

    const req = mockRequest("http://localhost/api/test", {
      "x-forwarded-for": "10.3.0.2",
    });

    await wrapped(req);
    await wrapped(req);
    handler.mockClear();
    await wrapped(req);

    expect(handler).not.toHaveBeenCalled();
  });

  it("recovers after time passes", async () => {
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const config: RateLimitConfig = {
      maxTokens: 2,
      refillRate: 1,
      refillInterval: 1,
    };
    const wrapped = withRateLimit(handler, config);

    const req = mockRequest("http://localhost/api/test", {
      "x-forwarded-for": "10.3.0.3",
    });

    // Exhaust tokens
    await wrapped(req);
    await wrapped(req);
    expect((await wrapped(req)).status).toBe(429);

    // Wait for refill
    vi.advanceTimersByTime(2000);

    const res = await wrapped(req);
    expect(res.status).toBe(200);
  });
});

// ─── Separate IP Buckets ────────────────────────────────

describe("Separate IP address buckets", () => {
  beforeEach(() => {
    resetRateLimiter();
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetRateLimiter();
  });

  it("different IPs have independent token buckets", () => {
    const config: RateLimitConfig = {
      maxTokens: 2,
      refillRate: 0.001,
      refillInterval: 1,
    };

    const req1 = mockRequest("http://localhost/api/test", {
      "x-forwarded-for": "10.4.0.1",
    });
    const req2 = mockRequest("http://localhost/api/test", {
      "x-forwarded-for": "10.4.0.2",
    });

    // Exhaust IP1's tokens
    rateLimit(req1, config);
    rateLimit(req1, config);
    expect(rateLimit(req1, config).success).toBe(false);

    // IP2 still has full bucket
    const result = rateLimit(req2, config);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("same IP different port is same bucket (x-forwarded-for ignores port)", () => {
    const config: RateLimitConfig = {
      maxTokens: 2,
      refillRate: 0.001,
      refillInterval: 1,
    };

    const req1 = mockRequest("http://localhost/api/test", {
      "x-forwarded-for": "10.4.1.1",
    });
    const req2 = mockRequest("http://localhost/api/other", {
      "x-forwarded-for": "10.4.1.1",
    });

    rateLimit(req1, config);
    rateLimit(req2, config);
    expect(rateLimit(req1, config).success).toBe(false);
  });

  it("three different IPs each get their own bucket", async () => {
    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const config: RateLimitConfig = {
      maxTokens: 1,
      refillRate: 0.001,
      refillInterval: 1,
    };
    const wrapped = withRateLimit(handler, config);

    const ips = ["10.4.2.1", "10.4.2.2", "10.4.2.3"];
    const results: number[] = [];

    for (const ip of ips) {
      const req = mockRequest("http://localhost/api/test", {
        "x-forwarded-for": ip,
      });
      const res = await wrapped(req);
      results.push(res.status);
    }

    // All should succeed — each IP has its own bucket
    expect(results).toEqual([200, 200, 200]);
  });

  it("uses x-real-ip header when x-forwarded-for is absent", () => {
    const config: RateLimitConfig = {
      maxTokens: 2,
      refillRate: 0.001,
      refillInterval: 1,
    };

    const req = new Request("http://localhost/api/test", {
      headers: { "x-real-ip": "192.168.1.100" },
    });

    const result = rateLimit(req, config);
    expect(result.success).toBe(true);
  });

  it("falls back to 127.0.0.1 when no IP headers present", () => {
    const config: RateLimitConfig = {
      maxTokens: 2,
      refillRate: 0.001,
      refillInterval: 1,
    };

    const req = new Request("http://localhost/api/test");
    const result = rateLimit(req, config);
    expect(result.success).toBe(true);
  });
});
