import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tripUpdateSchema } from "@/lib/validations";
import { apiError, handleApiError } from "@/lib/api-errors";
import { withAuth } from "@/lib/api-middleware";

export const GET = withAuth(async (
  request: Request,
  context?: unknown
) => {
  try {
    const { id } = await (context as { params: Promise<{ id: string }> }).params;
    const userId = request.headers.get("x-user-id")!;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        stops: {
          include: {
            river: {
              select: {
                id: true,
                name: true,
                state: true,
                difficulty: true,
                latitude: true,
                longitude: true,
              },
            },
          },
          orderBy: [{ dayNumber: "asc" }, { sortOrder: "asc" }],
        },
      },
    });

    if (!trip) {
      return apiError(404, "Trip not found");
    }

    // Only owner or public trips are accessible
    if (trip.userId !== userId && !trip.isPublic) {
      return apiError(404, "Trip not found");
    }

    return NextResponse.json(trip);
  } catch (error) {
    return handleApiError(error);
  }
});

export const PATCH = withAuth(async (
  request: Request,
  context?: unknown
) => {
  try {
    const { id } = await (context as { params: Promise<{ id: string }> }).params;
    const userId = request.headers.get("x-user-id")!;
    const body = await request.json();

    const parsed = tripUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.trip.findUnique({ where: { id } });
    if (!existing) {
      return apiError(404, "Trip not found");
    }
    if (existing.userId !== userId) {
      return apiError(403, "Not authorized to update this trip");
    }

    const { startDate, endDate, ...rest } = parsed.data;
    const data: Record<string, unknown> = { ...rest };
    if (startDate) data.startDate = new Date(startDate);
    if (endDate) data.endDate = new Date(endDate);

    const updated = await prisma.trip.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
});

export const DELETE = withAuth(async (
  _request: Request,
  context?: unknown
) => {
  try {
    const { id } = await (context as { params: Promise<{ id: string }> }).params;
    const userId = _request.headers.get("x-user-id")!;

    const existing = await prisma.trip.findUnique({ where: { id } });
    if (!existing) {
      return apiError(404, "Trip not found");
    }
    if (existing.userId !== userId) {
      return apiError(403, "Not authorized to delete this trip");
    }

    await prisma.trip.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
});
