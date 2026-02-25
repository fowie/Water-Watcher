import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, handleApiError } from "@/lib/api-errors";

/**
 * GET /api/rivers/[id]/analytics — Aggregate analytics for a river
 *
 * Returns:
 * - Flow rate trends (last 30 days, daily averages)
 * - Condition quality distribution (count by quality level)
 * - Best time to visit (month with most excellent/good conditions)
 * - Total reviews count and average rating
 * - Visit count (trips with stops at this river)
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // Verify river exists
    const river = await prisma.river.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!river) {
      return apiError(404, "River not found");
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Run all queries in parallel
    const [
      recentConditions,
      allConditionsForDistribution,
      reviewStats,
      visitCount,
      allConditionsForBestMonth,
    ] = await Promise.all([
      // Flow rate trends: conditions from last 30 days
      prisma.riverCondition.findMany({
        where: {
          riverId: id,
          scrapedAt: { gte: thirtyDaysAgo },
        },
        select: {
          flowRate: true,
          gaugeHeight: true,
          waterTemp: true,
          quality: true,
          scrapedAt: true,
        },
        orderBy: { scrapedAt: "asc" },
      }),

      // Quality distribution: all conditions for this river
      prisma.riverCondition.groupBy({
        by: ["quality"],
        where: { riverId: id, quality: { not: null } },
        _count: true,
      }),

      // Review stats: count and average rating
      prisma.riverReview.aggregate({
        where: { riverId: id },
        _count: true,
        _avg: { rating: true },
      }),

      // Visit count: trip stops referencing this river
      prisma.tripStop.count({
        where: { riverId: id },
      }),

      // All conditions with quality for best month calculation
      prisma.riverCondition.findMany({
        where: {
          riverId: id,
          quality: { in: ["excellent", "good"] },
        },
        select: { scrapedAt: true },
      }),
    ]);

    // ── Flow Rate Trends (daily averages for last 30 days) ──

    const dailyMap = new Map<
      string,
      { flowRates: number[]; gaugeHeights: number[]; waterTemps: number[] }
    >();

    for (const c of recentConditions) {
      const dateKey = c.scrapedAt.toISOString().split("T")[0]; // YYYY-MM-DD
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, {
          flowRates: [],
          gaugeHeights: [],
          waterTemps: [],
        });
      }
      const day = dailyMap.get(dateKey)!;
      if (c.flowRate != null) day.flowRates.push(c.flowRate);
      if (c.gaugeHeight != null) day.gaugeHeights.push(c.gaugeHeight);
      if (c.waterTemp != null) day.waterTemps.push(c.waterTemp);
    }

    const avg = (arr: number[]) =>
      arr.length > 0
        ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100
        : null;

    const flowTrends = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date,
        avgFlowRate: avg(data.flowRates),
        avgGaugeHeight: avg(data.gaugeHeights),
        avgWaterTemp: avg(data.waterTemps),
      }));

    // ── Condition Quality Distribution ──

    const qualityDistribution: Record<string, number> = {};
    for (const group of allConditionsForDistribution) {
      if (group.quality) {
        qualityDistribution[group.quality] = group._count;
      }
    }

    // ── Best Time to Visit ──

    const monthCountMap = new Map<number, number>();
    for (const c of allConditionsForBestMonth) {
      const month = c.scrapedAt.getMonth(); // 0-11
      monthCountMap.set(month, (monthCountMap.get(month) ?? 0) + 1);
    }

    const MONTH_NAMES = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];

    let bestMonth: string | null = null;
    let bestMonthCount = 0;
    for (const [month, count] of monthCountMap.entries()) {
      if (count > bestMonthCount) {
        bestMonthCount = count;
        bestMonth = MONTH_NAMES[month];
      }
    }

    // ── Build Response ──

    return NextResponse.json({
      riverId: id,
      riverName: river.name,
      flowTrends,
      qualityDistribution,
      bestTimeToVisit: bestMonth
        ? { month: bestMonth, goodConditionCount: bestMonthCount }
        : null,
      reviews: {
        totalCount: reviewStats._count,
        averageRating: reviewStats._avg.rating != null
          ? Math.round(reviewStats._avg.rating * 10) / 10
          : null,
      },
      visitCount,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
