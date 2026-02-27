import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/api-errors";

/**
 * GET /api/safety/active — list all active safety alerts across all rivers
 * Public endpoint for dashboard widget usage.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") ?? "50"), 1),
      200
    );
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0"), 0);
    const type = searchParams.get("type"); // optional filter by alert type
    const severity = searchParams.get("severity"); // optional filter by severity

    const now = new Date();

    const where: Record<string, unknown> = {
      activeFrom: { lte: now },
      OR: [
        { activeUntil: null },
        { activeUntil: { gte: now } },
      ],
    };

    if (type) {
      // Validate against allowed types
      const validTypes = [
        "CLOSURE", "PERMIT_REQUIRED", "HIGH_WATER",
        "LOW_WATER", "HAZARD_WARNING", "WEATHER_WARNING",
      ];
      if (validTypes.includes(type)) {
        where.type = type;
      }
    }

    if (severity) {
      const validSeverities = ["INFO", "WARNING", "CRITICAL"];
      if (validSeverities.includes(severity)) {
        where.severity = severity;
      }
    }

    const [alerts, total] = await Promise.all([
      prisma.safetyAlert.findMany({
        where,
        include: {
          river: {
            select: { id: true, name: true, state: true },
          },
        },
        orderBy: [
          { severity: "desc" },
          { activeFrom: "desc" },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.safetyAlert.count({ where }),
    ]);

    return NextResponse.json({
      alerts,
      total,
      limit,
      offset,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
