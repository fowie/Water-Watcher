import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, handleApiError } from "@/lib/api-errors";

const VALID_RANGES: Record<string, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  "90d": 90 * 24 * 60 * 60 * 1000,
};

/**
 * GET /api/rivers/:id/flow-history
 * Returns historical flow rate, gauge height, and water temp data points
 * for a river over a configurable time range.
 *
 * Query params:
 *   range — "24h" | "7d" | "30d" | "90d" (default: "7d")
 *
 * Response: { points: [...], river: { id, name }, range }
 */
export async function GET(
  request: Request,
  context?: unknown
) {
  try {
    const { id } = await (context as { params: Promise<{ id: string }> }).params;
    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") ?? "7d";

    if (!VALID_RANGES[range]) {
      return apiError(400, `Invalid range. Must be one of: ${Object.keys(VALID_RANGES).join(", ")}`);
    }

    const river = await prisma.river.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!river) {
      return apiError(404, "River not found");
    }

    const since = new Date(Date.now() - VALID_RANGES[range]);

    const conditions = await prisma.riverCondition.findMany({
      where: {
        riverId: id,
        scrapedAt: { gte: since },
      },
      select: {
        scrapedAt: true,
        flowRate: true,
        gaugeHeight: true,
        waterTemp: true,
        source: true,
      },
      orderBy: { scrapedAt: "asc" },
    });

    const points = conditions.map((c) => ({
      timestamp: c.scrapedAt.toISOString(),
      flowRate: c.flowRate,
      gaugeHeight: c.gaugeHeight,
      waterTemp: c.waterTemp,
      source: c.source,
    }));

    return NextResponse.json({
      points,
      river: { id: river.id, name: river.name },
      range,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
