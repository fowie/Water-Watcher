import { prisma } from "@/lib/db";

/**
 * GET /api/sse/rivers
 * Server-Sent Events endpoint for real-time river condition updates.
 * Sends initial snapshot of recently updated rivers (last 1 hour),
 * then polls DB every 30 seconds for new conditions.
 *
 * Event types: condition-update, hazard-alert, deal-match
 */
export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      function send(event: string, data: unknown) {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          closed = true;
        }
      }

      // Send retry directive for auto-reconnect (5 seconds)
      try {
        controller.enqueue(encoder.encode("retry: 5000\n\n"));
      } catch {
        closed = true;
      }

      // --- Initial snapshot: conditions updated in the last hour ---
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      let lastPollTime = new Date();

      try {
        const recentConditions = await prisma.riverCondition.findMany({
          where: { scrapedAt: { gte: oneHourAgo } },
          include: {
            river: { select: { id: true, name: true, state: true, difficulty: true } },
          },
          orderBy: { scrapedAt: "desc" },
          take: 50,
        });

        for (const condition of recentConditions) {
          send("condition-update", {
            id: condition.id,
            riverId: condition.riverId,
            riverName: condition.river.name,
            state: condition.river.state,
            flowRate: condition.flowRate,
            gaugeHeight: condition.gaugeHeight,
            waterTemp: condition.waterTemp,
            quality: condition.quality,
            runnability: condition.runnability,
            source: condition.source,
            scrapedAt: condition.scrapedAt.toISOString(),
          });
        }

        // Send recent hazards
        const recentHazards = await prisma.hazard.findMany({
          where: { reportedAt: { gte: oneHourAgo }, isActive: true },
          include: {
            river: { select: { id: true, name: true } },
          },
          orderBy: { reportedAt: "desc" },
          take: 20,
        });

        for (const hazard of recentHazards) {
          send("hazard-alert", {
            id: hazard.id,
            riverId: hazard.riverId,
            riverName: hazard.river.name,
            type: hazard.type,
            severity: hazard.severity,
            title: hazard.title,
            description: hazard.description,
            reportedAt: hazard.reportedAt.toISOString(),
          });
        }

        // Send recent deal matches
        const recentMatches = await prisma.dealFilterMatch.findMany({
          where: { createdAt: { gte: oneHourAgo } },
          include: {
            deal: { select: { id: true, title: true, price: true, url: true, category: true } },
            filter: { select: { id: true, name: true, userId: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        });

        for (const match of recentMatches) {
          send("deal-match", {
            matchId: match.id,
            dealId: match.deal.id,
            dealTitle: match.deal.title,
            dealPrice: match.deal.price,
            dealUrl: match.deal.url,
            category: match.deal.category,
            filterId: match.filter.id,
            filterName: match.filter.name,
            matchedAt: match.createdAt.toISOString(),
          });
        }
      } catch (error) {
        console.error("SSE initial snapshot error:", error);
      }

      // --- Polling loop: check for new data every 30 seconds ---
      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }

        try {
          // New conditions since last poll
          const newConditions = await prisma.riverCondition.findMany({
            where: { scrapedAt: { gt: lastPollTime } },
            include: {
              river: { select: { id: true, name: true, state: true, difficulty: true } },
            },
            orderBy: { scrapedAt: "desc" },
            take: 50,
          });

          for (const condition of newConditions) {
            send("condition-update", {
              id: condition.id,
              riverId: condition.riverId,
              riverName: condition.river.name,
              state: condition.river.state,
              flowRate: condition.flowRate,
              gaugeHeight: condition.gaugeHeight,
              waterTemp: condition.waterTemp,
              quality: condition.quality,
              runnability: condition.runnability,
              source: condition.source,
              scrapedAt: condition.scrapedAt.toISOString(),
            });
          }

          // New hazards since last poll
          const newHazards = await prisma.hazard.findMany({
            where: { reportedAt: { gt: lastPollTime }, isActive: true },
            include: {
              river: { select: { id: true, name: true } },
            },
            orderBy: { reportedAt: "desc" },
            take: 20,
          });

          for (const hazard of newHazards) {
            send("hazard-alert", {
              id: hazard.id,
              riverId: hazard.riverId,
              riverName: hazard.river.name,
              type: hazard.type,
              severity: hazard.severity,
              title: hazard.title,
              description: hazard.description,
              reportedAt: hazard.reportedAt.toISOString(),
            });
          }

          // New deal matches since last poll
          const newMatches = await prisma.dealFilterMatch.findMany({
            where: { createdAt: { gt: lastPollTime } },
            include: {
              deal: { select: { id: true, title: true, price: true, url: true, category: true } },
              filter: { select: { id: true, name: true, userId: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 20,
          });

          for (const match of newMatches) {
            send("deal-match", {
              matchId: match.id,
              dealId: match.deal.id,
              dealTitle: match.deal.title,
              dealPrice: match.deal.price,
              dealUrl: match.deal.url,
              category: match.deal.category,
              filterId: match.filter.id,
              filterName: match.filter.name,
              matchedAt: match.createdAt.toISOString(),
            });
          }

          lastPollTime = new Date();
        } catch (error) {
          console.error("SSE poll error:", error);
        }
      }, 30_000);

      // Cleanup on abort (connection close)
      const cleanup = () => {
        closed = true;
        clearInterval(interval);
      };

      // The cancel callback is called when the client disconnects
      // Store cleanup ref so cancel() can invoke it
      (stream as unknown as Record<string, () => void>).__cleanup = cleanup;
    },

    cancel() {
      // Client disconnected — invoke cleanup to clear interval
      const cleanup = (stream as unknown as Record<string, () => void>).__cleanup;
      if (cleanup) cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable Nginx buffering
    },
  });
}
