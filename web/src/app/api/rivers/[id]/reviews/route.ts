import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { reviewSchema } from "@/lib/validations";
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

    const [reviews, total] = await Promise.all([
      prisma.riverReview.findMany({
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
      prisma.riverReview.count({ where: { riverId } }),
    ]);

    // Calculate average rating
    const avgResult = await prisma.riverReview.aggregate({
      where: { riverId },
      _avg: { rating: true },
    });

    return NextResponse.json({
      reviews,
      total,
      limit,
      offset,
      averageRating: avgResult._avg.rating,
    });
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

      const parsed = reviewSchema.safeParse(body);
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

      const { visitDate, ...rest } = parsed.data;
      const data = {
        ...rest,
        ...(visitDate ? { visitDate: new Date(visitDate) } : {}),
      };

      // Upsert: one review per river per user
      const review = await prisma.riverReview.upsert({
        where: {
          riverId_userId: { riverId, userId },
        },
        create: {
          ...data,
          riverId,
          userId,
        },
        update: data,
        include: {
          user: {
            select: { id: true, name: true, image: true },
          },
        },
      });

      return NextResponse.json(review, { status: 201 });
    } catch (error) {
      return handleApiError(error);
    }
  }),
  reviewConfig
);
