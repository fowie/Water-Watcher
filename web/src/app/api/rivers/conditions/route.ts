import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, handleApiError } from "@/lib/api-errors";

/**
 * GET /api/rivers/conditions
 * Batch endpoint: returns the latest condition for each requested river.
 *
 * Query params:
 *   ids — comma-separated river IDs (required, max 50)
 *
 * Response: { conditions: { [riverId]: { ... } | null } }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const idsParam = searchParams.get("ids");

    if (!idsParam) {
      return apiError(400, "Missing required query parameter: ids");
    }

    const ids = idsParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      return apiError(400, "At least one river ID is required");
    }

    if (ids.length > 50) {
      return apiError(400, "Maximum 50 river IDs per request");
    }

    // Fetch the most recent condition per river using a subquery approach:
    // Get all conditions for these rivers, then pick the latest per river.
    const conditions = await prisma.riverCondition.findMany({
      where: { riverId: { in: ids } },
      include: {
        river: {
          select: { id: true, name: true, state: true, difficulty: true },
        },
      },
      orderBy: { scrapedAt: "desc" },
    });

    // Group by riverId and take the first (most recent) for each
    const latestByRiver: Record<string, unknown> = {};
    for (const id of ids) {
      latestByRiver[id] = null; // Initialize all requested IDs
    }

    for (const condition of conditions) {
      if (latestByRiver[condition.riverId] !== null) continue; // Already have latest

      latestByRiver[condition.riverId] = {
        id: condition.id,
        riverId: condition.riverId,
        riverName: condition.river.name,
        state: condition.river.state,
        difficulty: condition.river.difficulty,
        flowRate: condition.flowRate,
        gaugeHeight: condition.gaugeHeight,
        waterTemp: condition.waterTemp,
        quality: condition.quality,
        runnability: condition.runnability,
        source: condition.source,
        scrapedAt: condition.scrapedAt.toISOString(),
      };
    }

    return NextResponse.json({ conditions: latestByRiver });
  } catch (error) {
    return handleApiError(error);
  }
}
