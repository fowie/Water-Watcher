import { NextResponse } from "next/server";

/**
 * CSP violation report endpoint.
 * Receives Content-Security-Policy violation reports from the browser
 * and logs them for monitoring.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Log the CSP violation for monitoring
    const report = body["csp-report"] ?? body;
    console.warn("[CSP Violation]", {
      documentUri: report["document-uri"],
      violatedDirective: report["violated-directive"],
      blockedUri: report["blocked-uri"],
      sourceFile: report["source-file"],
      lineNumber: report["line-number"],
      columnNumber: report["column-number"],
    });

    return new NextResponse(null, { status: 204 });
  } catch {
    // Accept malformed reports gracefully
    return new NextResponse(null, { status: 204 });
  }
}
