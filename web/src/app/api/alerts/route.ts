import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { handleApiError } from "@/lib/api-errors";

/**
 * GET /api/alerts
 * Returns a paginated list of past alerts sent to the authenticated user.
 * Query params: limit (default 20, max 100), offset (default 0), type (optional filter).
 */
export const GET = withAuth(async (request: Request) => {
  try {
    const userId = request.headers.get("x-user-id")!;
    const { searchParams } = new URL(request.url);

    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 1), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);
    const type = searchParams.get("type"); // "deal", "condition", "hazard", "digest"

    const where: Record<string, unknown> = { userId };
    if (type) {
      where.type = type;
    }

    const [alerts, total] = await Promise.all([
      prisma.alertLog.findMany({
        where,
        orderBy: { sentAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.alertLog.count({ where }),
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
});
