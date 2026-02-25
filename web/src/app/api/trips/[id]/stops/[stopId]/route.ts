import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, handleApiError } from "@/lib/api-errors";
import { withAuth } from "@/lib/api-middleware";

export const DELETE = withAuth(async (
  request: Request,
  context?: unknown
) => {
  try {
    const { id: tripId, stopId } = await (
      context as { params: Promise<{ id: string; stopId: string }> }
    ).params;
    const userId = request.headers.get("x-user-id")!;

    // Check trip exists and user owns it
    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      return apiError(404, "Trip not found");
    }
    if (trip.userId !== userId) {
      return apiError(403, "Not authorized to modify this trip");
    }

    // Check stop exists and belongs to this trip
    const stop = await prisma.tripStop.findUnique({ where: { id: stopId } });
    if (!stop || stop.tripId !== tripId) {
      return apiError(404, "Trip stop not found");
    }

    await prisma.tripStop.delete({ where: { id: stopId } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
});
