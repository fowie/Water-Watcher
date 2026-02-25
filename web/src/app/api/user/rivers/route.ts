import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, handleApiError } from "@/lib/api-errors";
import { withAuth } from "@/lib/api-middleware";

/**
 * GET /api/user/rivers
 * Returns the authenticated user's tracked rivers with latest conditions.
 */
export const GET = withAuth(async (request: Request) => {
  try {
    const userId = request.headers.get("x-user-id")!;

    const userRivers = await prisma.userRiver.findMany({
      where: { userId },
      include: {
        river: {
          include: {
            conditions: {
              orderBy: { scrapedAt: "desc" },
              take: 1,
            },
            hazards: {
              where: { isActive: true },
            },
            _count: {
              select: { trackedBy: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const rivers = userRivers.map((ur) => ({
      id: ur.river.id,
      name: ur.river.name,
      state: ur.river.state,
      difficulty: ur.river.difficulty,
      latestCondition: ur.river.conditions[0]
        ? {
            quality: ur.river.conditions[0].quality,
            flowRate: ur.river.conditions[0].flowRate,
            runnability: ur.river.conditions[0].runnability,
            scrapedAt: ur.river.conditions[0].scrapedAt,
          }
        : null,
      activeHazardCount: ur.river.hazards.length,
      trackerCount: ur.river._count.trackedBy,
      trackedAt: ur.createdAt,
    }));

    return NextResponse.json({ rivers });
  } catch (error) {
    return handleApiError(error);
  }
});

/**
 * POST /api/user/rivers
 * Add a river to the user's tracking list.
 * Body: { riverId: string }
 */
export const POST = withAuth(async (request: Request) => {
  try {
    const userId = request.headers.get("x-user-id")!;
    const body = await request.json();
    const { riverId } = body;

    if (!riverId || typeof riverId !== "string") {
      return apiError(400, "riverId is required");
    }

    // Check river exists
    const river = await prisma.river.findUnique({
      where: { id: riverId },
      select: { id: true },
    });

    if (!river) {
      return apiError(404, "River not found");
    }

    // Check if already tracked
    const existing = await prisma.userRiver.findUnique({
      where: { userId_riverId: { userId, riverId } },
    });

    if (existing) {
      return apiError(409, "River is already tracked");
    }

    const userRiver = await prisma.userRiver.create({
      data: { userId, riverId },
    });

    return NextResponse.json(
      { id: userRiver.id, riverId: userRiver.riverId },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
});

/**
 * DELETE /api/user/rivers
 * Remove a river from tracking. Query param: ?riverId=xxx
 */
export const DELETE = withAuth(async (request: Request) => {
  try {
    const userId = request.headers.get("x-user-id")!;
    const url = new URL(request.url);
    const riverId = url.searchParams.get("riverId");

    if (!riverId) {
      return apiError(400, "riverId query parameter is required");
    }

    const existing = await prisma.userRiver.findUnique({
      where: { userId_riverId: { userId, riverId } },
    });

    if (!existing) {
      return apiError(404, "River is not tracked");
    }

    await prisma.userRiver.delete({
      where: { userId_riverId: { userId, riverId } },
    });

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
});
