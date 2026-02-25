/**
 * Tests for security headers in next.config.ts.
 *
 * Imports the Next.js config and verifies the security headers
 * returned by the headers() function.
 */

import { describe, it, expect } from "vitest";
import nextConfig from "../../../next.config";

describe("Security Headers (next.config.ts)", () => {
  let headers: { key: string; value: string }[];

  // Resolve the headers once before all tests
  const getHeaders = async () => {
    if (headers) return headers;
    const result = await nextConfig.headers!();
    // The first (and only) entry applies to all routes "/(.*)"
    headers = result[0].headers;
    return headers;
  };

  const findHeader = async (name: string) => {
    const h = await getHeaders();
    return h.find((hdr) => hdr.key.toLowerCase() === name.toLowerCase());
  };

  it("exports a headers function", () => {
    expect(nextConfig.headers).toBeDefined();
    expect(typeof nextConfig.headers).toBe("function");
  });

  it("applies headers to all routes", async () => {
    const result = await nextConfig.headers!();
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("/(.*)");
  });

  it("contains X-Frame-Options: DENY", async () => {
    const header = await findHeader("X-Frame-Options");
    expect(header).toBeDefined();
    expect(header!.value).toBe("DENY");
  });

  it("contains X-Content-Type-Options: nosniff", async () => {
    const header = await findHeader("X-Content-Type-Options");
    expect(header).toBeDefined();
    expect(header!.value).toBe("nosniff");
  });

  it("contains Referrer-Policy", async () => {
    const header = await findHeader("Referrer-Policy");
    expect(header).toBeDefined();
    expect(header!.value).toBe("strict-origin-when-cross-origin");
  });

  it("contains Permissions-Policy", async () => {
    const header = await findHeader("Permissions-Policy");
    expect(header).toBeDefined();
    expect(header!.value).toContain("camera=()");
    expect(header!.value).toContain("microphone=()");
    expect(header!.value).toContain("geolocation=(self)");
  });

  it("contains X-XSS-Protection", async () => {
    const header = await findHeader("X-XSS-Protection");
    expect(header).toBeDefined();
    expect(header!.value).toBe("1; mode=block");
  });

  it("contains Strict-Transport-Security (HSTS)", async () => {
    const header = await findHeader("Strict-Transport-Security");
    expect(header).toBeDefined();
    expect(header!.value).toContain("max-age=");
    expect(header!.value).toContain("includeSubDomains");
  });

  it("has at least 5 security headers", async () => {
    const h = await getHeaders();
    expect(h.length).toBeGreaterThanOrEqual(5);
  });

  it("standalone output mode is set", () => {
    expect(nextConfig.output).toBe("standalone");
  });
});
