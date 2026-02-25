import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { photoSchema } from "@/lib/validations";
import { apiError, handleApiError } from "@/lib/api-errors";
import { withAuth, withRateLimit } from "@/lib/api-middleware";
import { reviewConfig } from "@/lib/rate-limit";

export async function GET(
  request: Request,
  context?: unknown
) {
  try {
    const { id: riverId } = await (context as { params: Promise<{ id: string }> }).params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") ?? "20"), 1),
      100
    );
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0"), 0);

    // Verify river exists
    const river = await prisma.river.findUnique({ where: { id: riverId } });
    if (!river) {
      return apiError(404, "River not found");
    }

    const [photos, total] = await Promise.all([
      prisma.riverPhoto.findMany({
        where: { riverId },
        include: {
          user: {
            select: { id: true, name: true, image: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.riverPhoto.count({ where: { riverId } }),
    ]);

    return NextResponse.json({ photos, total, limit, offset });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRateLimit(
  withAuth(async (
    request: Request,
    context?: unknown
  ) => {
    try {
      const { id: riverId } = await (context as { params: Promise<{ id: string }> }).params;
      const userId = request.headers.get("x-user-id")!;
      const body = await request.json();

      const parsed = photoSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid input", details: parsed.error.flatten() },
          { status: 400 }
        );
      }

      // Verify river exists
      const river = await prisma.river.findUnique({ where: { id: riverId } });
      if (!river) {
        return apiError(404, "River not found");
      }

      // Check max 20 photos per user per river
      const count = await prisma.riverPhoto.count({
        where: { riverId, userId },
      });
      if (count >= 20) {
        return apiError(400, "Maximum 20 photos per user per river");
      }

      const photo = await prisma.riverPhoto.create({
        data: {
          riverId,
          userId,
          url: parsed.data.url,
          caption: parsed.data.caption ?? null,
          takenAt: parsed.data.takenAt ? new Date(parsed.data.takenAt) : null,
        },
        include: {
          user: {
            select: { id: true, name: true, image: true },
          },
        },
      });

      return NextResponse.json(photo, { status: 201 });
    } catch (error) {
      return handleApiError(error);
    }
  }),
  reviewConfig // 10 per minute
);
