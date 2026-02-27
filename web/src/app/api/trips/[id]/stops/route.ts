import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tripStopSchema } from "@/lib/validations";
import { apiError, handleApiError } from "@/lib/api-errors";
import { withAuth, withApiRateLimit } from "@/lib/api-middleware";

export const POST = withApiRateLimit(withAuth(async (
  request: Request,
  context?: unknown
) => {
  try {
    const { id: tripId } = await (context as { params: Promise<{ id: string }> }).params;
    const userId = request.headers.get("x-user-id")!;
    const body = await request.json();

    const parsed = tripStopSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Check trip exists and user owns it
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      return apiError(404, "Trip not found");
    }
    if (trip.userId !== userId) {
      return apiError(403, "Not authorized to modify this trip");
    }

    // Validate river exists
    const river = await prisma.river.findUnique({ where: { id: parsed.data.riverId } });
    if (!river) {
      return apiError(404, "River not found");
    }

    const stop = await prisma.tripStop.create({
      data: {
        ...parsed.data,
        tripId,
      },
      include: {
        river: {
          select: { id: true, name: true, state: true, difficulty: true },
        },
      },
    });

    return NextResponse.json(stop, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}));
