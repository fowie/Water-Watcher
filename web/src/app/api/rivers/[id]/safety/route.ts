import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { safetyAlertSchema } from "@/lib/validations";
import { apiError, handleApiError } from "@/lib/api-errors";
import { requireAdmin, isAdminError } from "@/lib/admin";
import { sanitizeHtml, truncate } from "@/lib/sanitize";

/**
 * GET /api/rivers/[id]/safety — list active safety alerts for a river
 */
export async function GET(
  request: Request,
  context?: unknown
) {
  try {
    const { id: riverId } = await (context as { params: Promise<{ id: string }> }).params;
    const { searchParams } = new URL(request.url);
    const includeExpired = searchParams.get("includeExpired") === "true";

    const river = await prisma.river.findUnique({ where: { id: riverId } });
    if (!river) {
      return apiError(404, "River not found");
    }

    const now = new Date();
    const where: Record<string, unknown> = { riverId };

    if (!includeExpired) {
      where.activeFrom = { lte: now };
      where.OR = [
        { activeUntil: null },
        { activeUntil: { gte: now } },
      ];
    }

    const alerts = await prisma.safetyAlert.findMany({
      where,
      orderBy: [
        { severity: "desc" },
        { activeFrom: "desc" },
      ],
    });

    // Check for auto-generated HIGH_WATER alert based on flow data
    const highWaterFlag = await checkHighWaterCondition(riverId);

    return NextResponse.json({
      alerts,
      riverId,
      highWaterFlag,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/rivers/[id]/safety — create a safety alert (admin only)
 */
export async function POST(
  request: Request,
  context?: unknown
) {
  const adminResult = await requireAdmin();
  if (isAdminError(adminResult)) return adminResult;

  try {
    const { id: riverId } = await (context as { params: Promise<{ id: string }> }).params;

    const river = await prisma.river.findUnique({ where: { id: riverId } });
    if (!river) {
      return apiError(404, "River not found");
    }

    const body = await request.json();

    // Normalize casing for type and severity before validation
    if (body.type && typeof body.type === "string") {
      body.type = body.type.toUpperCase();
    }
    if (body.severity && typeof body.severity === "string") {
      body.severity = body.severity.toUpperCase();
    }
    // Default activeFrom to now if not provided
    if (!body.activeFrom) {
      body.activeFrom = new Date().toISOString();
    }

    const parsed = safetyAlertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { activeFrom, activeUntil, ...rest } = parsed.data;
    const data = {
      ...rest,
      title: truncate(sanitizeHtml(rest.title), 200),
      ...(rest.description ? { description: truncate(sanitizeHtml(rest.description), 5000) } : {}),
      activeFrom: new Date(activeFrom),
      activeUntil: activeUntil ? new Date(activeUntil) : null,
    };

    const alert = await prisma.safetyAlert.create({
      data: {
        ...data,
        riverId,
      },
    });

    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
};

/**
 * Check if a river's current flow rate exceeds 2x its historical average.
 * Returns a flag object if dangerous, null otherwise.
 */
async function checkHighWaterCondition(riverId: string): Promise<{
  triggered: boolean;
  currentFlowRate: number | null;
  historicalAverage: number | null;
  ratio: number | null;
} | null> {
  try {
    // Get most recent flow reading
    const latestCondition = await prisma.riverCondition.findFirst({
      where: { riverId, flowRate: { not: null } },
      orderBy: { scrapedAt: "desc" },
      select: { flowRate: true },
    });

    if (!latestCondition?.flowRate) return null;

    // Calculate historical average flow rate (all time)
    const avgResult = await prisma.riverCondition.aggregate({
      where: { riverId, flowRate: { not: null } },
      _avg: { flowRate: true },
    });

    const historicalAvg = avgResult._avg.flowRate;
    if (!historicalAvg || historicalAvg === 0) return null;

    const ratio = latestCondition.flowRate / historicalAvg;

    return {
      triggered: ratio >= 2.0,
      currentFlowRate: latestCondition.flowRate,
      historicalAverage: Math.round(historicalAvg * 100) / 100,
      ratio: Math.round(ratio * 100) / 100,
    };
  } catch {
    return null;
  }
}
