/**
 * Tests for Content Security Policy (CSP) and security headers in next.config.ts.
 *
 * Verifies:
 * - CSP header is present with all required directives
 * - Leaflet CDN (unpkg.com) is allowed in style-src
 * - Open-Meteo is allowed in connect-src
 * - data: is allowed in img-src
 * - frame-ancestors is 'none'
 * - CSP report endpoint (POST /api/csp-report) accepts reports, returns 204
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import nextConfig from "../../next.config";

describe("CSP & Security Headers (next.config.ts)", () => {
  let headers: { key: string; value: string }[];
  let cspValue: string;

  const getHeaders = async () => {
    if (headers) return headers;
    const result = await nextConfig.headers!();
    headers = result[0].headers;
    return headers;
  };

  const getCSP = async () => {
    if (cspValue) return cspValue;
    const h = await getHeaders();
    const csp = h.find(
      (hdr) => hdr.key.toLowerCase() === "content-security-policy"
    );
    cspValue = csp!.value;
    return cspValue;
  };

  // Parse CSP string into a directive map
  const parseCSP = async () => {
    const raw = await getCSP();
    const map: Record<string, string> = {};
    for (const part of raw.split(";")) {
      const trimmed = part.trim();
      const spaceIdx = trimmed.indexOf(" ");
      if (spaceIdx > 0) {
        const key = trimmed.substring(0, spaceIdx);
        const value = trimmed.substring(spaceIdx + 1);
        map[key] = value;
      } else if (trimmed) {
        map[trimmed] = "";
      }
    }
    return map;
  };

  // ─── CSP Header Presence ───────────────────────────────

  it("includes Content-Security-Policy header", async () => {
    const h = await getHeaders();
    const csp = h.find(
      (hdr) => hdr.key.toLowerCase() === "content-security-policy"
    );
    expect(csp).toBeDefined();
    expect(csp!.value.length).toBeGreaterThan(0);
  });

  // ─── Required Directives ──────────────────────────────

  it("has default-src directive", async () => {
    const directives = await parseCSP();
    expect(directives["default-src"]).toBeDefined();
    expect(directives["default-src"]).toContain("'self'");
  });

  it("has script-src directive", async () => {
    const directives = await parseCSP();
    expect(directives["script-src"]).toBeDefined();
    expect(directives["script-src"]).toContain("'self'");
  });

  it("has style-src directive", async () => {
    const directives = await parseCSP();
    expect(directives["style-src"]).toBeDefined();
    expect(directives["style-src"]).toContain("'self'");
  });

  it("has img-src directive", async () => {
    const directives = await parseCSP();
    expect(directives["img-src"]).toBeDefined();
  });

  it("has connect-src directive", async () => {
    const directives = await parseCSP();
    expect(directives["connect-src"]).toBeDefined();
  });

  it("has font-src directive", async () => {
    const directives = await parseCSP();
    expect(directives["font-src"]).toBeDefined();
    expect(directives["font-src"]).toContain("'self'");
  });

  it("has frame-ancestors directive", async () => {
    const directives = await parseCSP();
    expect(directives["frame-ancestors"]).toBeDefined();
  });

  // ─── Specific Source Allowances ────────────────────────

  it("allows Leaflet CDN (unpkg.com) in style-src", async () => {
    const directives = await parseCSP();
    expect(directives["style-src"]).toContain("https://unpkg.com");
  });

  it("allows 'unsafe-inline' in style-src (for Leaflet)", async () => {
    const directives = await parseCSP();
    expect(directives["style-src"]).toContain("'unsafe-inline'");
  });

  it("allows open-meteo.com in connect-src", async () => {
    const directives = await parseCSP();
    expect(directives["connect-src"]).toContain("https://api.open-meteo.com");
  });

  it("allows data: in img-src", async () => {
    const directives = await parseCSP();
    expect(directives["img-src"]).toContain("data:");
  });

  it("sets frame-ancestors to 'none'", async () => {
    const directives = await parseCSP();
    expect(directives["frame-ancestors"]).toBe("'none'");
  });

  // ─── Additional CSP Directives ─────────────────────────

  it("has report-uri pointing to /api/csp-report", async () => {
    const directives = await parseCSP();
    expect(directives["report-uri"]).toBe("/api/csp-report");
  });

  it("has object-src 'none'", async () => {
    const directives = await parseCSP();
    expect(directives["object-src"]).toBe("'none'");
  });

  it("has base-uri 'self'", async () => {
    const directives = await parseCSP();
    expect(directives["base-uri"]).toBe("'self'");
  });

  it("has form-action 'self'", async () => {
    const directives = await parseCSP();
    expect(directives["form-action"]).toBe("'self'");
  });

  it("has worker-src allowing blob:", async () => {
    const directives = await parseCSP();
    expect(directives["worker-src"]).toContain("blob:");
  });

  it("allows OAuth providers in connect-src", async () => {
    const directives = await parseCSP();
    expect(directives["connect-src"]).toContain("https://accounts.google.com");
    expect(directives["connect-src"]).toContain("https://github.com");
  });
});

// ─── CSP Report Endpoint ──────────────────────────────────

describe("POST /api/csp-report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts a valid CSP violation report and returns 204", async () => {
    const { POST } = await import("@/app/api/csp-report/route");

    const report = {
      "csp-report": {
        "document-uri": "https://example.com/page",
        "violated-directive": "script-src 'self'",
        "blocked-uri": "https://evil.com/exploit.js",
        "source-file": "https://example.com/page",
        "line-number": 42,
        "column-number": 7,
      },
    };

    const req = new Request("http://localhost:3000/api/csp-report", {
      method: "POST",
      headers: { "Content-Type": "application/csp-report" },
      body: JSON.stringify(report),
    });

    const res = await POST(req);
    expect(res.status).toBe(204);
  });

  it("accepts flat report format (without csp-report wrapper)", async () => {
    const { POST } = await import("@/app/api/csp-report/route");

    const report = {
      "document-uri": "https://example.com/page",
      "violated-directive": "img-src 'self'",
      "blocked-uri": "data:",
    };

    const req = new Request("http://localhost:3000/api/csp-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    });

    const res = await POST(req);
    expect(res.status).toBe(204);
  });

  it("returns 204 even for malformed JSON", async () => {
    const { POST } = await import("@/app/api/csp-report/route");

    const req = new Request("http://localhost:3000/api/csp-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-valid-json{{{",
    });

    const res = await POST(req);
    expect(res.status).toBe(204);
  });

  it("returns 204 for empty body", async () => {
    const { POST } = await import("@/app/api/csp-report/route");

    const req = new Request("http://localhost:3000/api/csp-report", {
      method: "POST",
      body: "",
    });

    const res = await POST(req);
    expect(res.status).toBe(204);
  });

  it("returns no response body on 204", async () => {
    const { POST } = await import("@/app/api/csp-report/route");

    const report = {
      "csp-report": {
        "document-uri": "https://example.com",
        "violated-directive": "default-src",
        "blocked-uri": "inline",
      },
    };

    const req = new Request("http://localhost:3000/api/csp-report", {
      method: "POST",
      headers: { "Content-Type": "application/csp-report" },
      body: JSON.stringify(report),
    });

    const res = await POST(req);
    expect(res.status).toBe(204);
    const body = await res.text();
    expect(body).toBe("");
  });
});
