import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, handleApiError } from "@/lib/api-errors";
import { requireAdmin, isAdminError } from "@/lib/admin";

const VALID_SOURCES = ["usgs", "aw", "craigslist", "blm", "usfs"];

export async function GET(
  _request: Request,
  context: { params: Promise<{ source: string }> }
) {
  const adminResult = await requireAdmin();
  if (isAdminError(adminResult)) return adminResult;

  try {
    const { source } = await context.params;

    if (!VALID_SOURCES.includes(source)) {
      return apiError(400, `Invalid source. Must be one of: ${VALID_SOURCES.join(", ")}`);
    }

    // Last 50 scrape log entries
    const logs = await prisma.scrapeLog.findMany({
      where: { source },
      orderBy: { startedAt: "desc" },
      take: 50,
    });

    // Aggregate stats from all logs for this source
    const [totalCount, aggregates] = await Promise.all([
      prisma.scrapeLog.count({ where: { source } }),
      prisma.scrapeLog.aggregate({
        where: { source },
        _sum: { itemCount: true },
        _avg: { itemCount: true, duration: true },
      }),
    ]);

    const successCount = await prisma.scrapeLog.count({
      where: { source, status: "success" },
    });

    const successRate = totalCount > 0
      ? Math.round((successCount / totalCount) * 100 * 10) / 10
      : 0;

    return NextResponse.json({
      source,
      logs: logs.map((l) => ({
        id: l.id,
        status: l.status,
        itemCount: l.itemCount,
        error: l.error,
        duration: l.duration,
        startedAt: l.startedAt,
        finishedAt: l.finishedAt,
      })),
      stats: {
        totalScrapes: totalCount,
        successRate,
        avgItemsPerRun: aggregates._avg.itemCount != null
          ? Math.round(aggregates._avg.itemCount * 10) / 10
          : 0,
        totalItems: aggregates._sum.itemCount ?? 0,
        avgDurationMs: aggregates._avg.duration != null
          ? Math.round(aggregates._avg.duration)
          : null,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
