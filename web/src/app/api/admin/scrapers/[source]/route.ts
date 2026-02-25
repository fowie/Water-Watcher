import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, handleApiError } from "@/lib/api-errors";
import { withAuth } from "@/lib/api-middleware";

const VALID_SOURCES = ["usgs", "aw", "craigslist", "blm", "usfs"];

export const GET = withAuth(async (
  _request: Request,
  context?: unknown
) => {
  try {
    const { source } = await (context as { params: Promise<{ source: string }> }).params;

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
});
