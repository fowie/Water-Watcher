import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/api-errors";
import { requireAdmin, isAdminError } from "@/lib/admin";

export async function GET() {
  const adminResult = await requireAdmin();
  if (isAdminError(adminResult)) return adminResult;

  try {
    const sources = ["usgs", "aw", "craigslist", "blm", "usfs"];
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get scraper stats grouped by source
    const scraperStats = await Promise.all(
      sources.map(async (source) => {
        const [logs, lastScrape, totalItems] = await Promise.all([
          // Scrapes in last 24h
          prisma.scrapeLog.findMany({
            where: {
              source,
              startedAt: { gte: twentyFourHoursAgo },
            },
            orderBy: { startedAt: "desc" },
          }),
          // Most recent scrape
          prisma.scrapeLog.findFirst({
            where: { source },
            orderBy: { startedAt: "desc" },
          }),
          // Total items scraped in last 24h
          prisma.scrapeLog.aggregate({
            where: {
              source,
              startedAt: { gte: twentyFourHoursAgo },
            },
            _sum: { itemCount: true },
          }),
        ]);

        const successCount = logs.filter((l) => l.status === "success").length;
        const durations = logs
          .filter((l) => l.duration != null)
          .map((l) => l.duration!);
        const avgDuration =
          durations.length > 0
            ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
            : null;

        return {
          source,
          lastScrapeAt: lastScrape?.startedAt ?? null,
          lastStatus: lastScrape?.status ?? null,
          totalScrapes24h: logs.length,
          successCount24h: successCount,
          itemsScraped24h: totalItems._sum.itemCount ?? 0,
          avgDurationMs: avgDuration,
        };
      })
    );

    // Global stats
    const [totalRivers, conditionsLast24h, activeHazards] = await Promise.all([
      prisma.river.count(),
      prisma.riverCondition.count({
        where: { scrapedAt: { gte: twentyFourHoursAgo } },
      }),
      prisma.hazard.count({
        where: { isActive: true },
      }),
    ]);

    return NextResponse.json({
      scrapers: scraperStats,
      summary: {
        totalRiversTracked: totalRivers,
        conditionsLast24h,
        activeHazards,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
