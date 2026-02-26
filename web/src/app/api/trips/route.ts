import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tripSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/api-errors";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeHtml, truncate } from "@/lib/sanitize";

export const GET = withAuth(async (request: Request) => {
  try {
    const userId = request.headers.get("x-user-id")!;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const upcoming = searchParams.get("upcoming");

    const where: Record<string, unknown> = { userId };
    if (status) where.status = status;
    if (upcoming === "true") {
      where.startDate = { gte: new Date() };
    }

    const trips = await prisma.trip.findMany({
      where,
      include: {
        stops: {
          include: {
            river: {
              select: { id: true, name: true, state: true, difficulty: true },
            },
          },
          orderBy: [{ dayNumber: "asc" }, { sortOrder: "asc" }],
        },
        _count: { select: { stops: true } },
      },
      orderBy: { startDate: "asc" },
    });

    return NextResponse.json({ trips });
  } catch (error) {
    return handleApiError(error);
  }
});

export const POST = withAuth(async (request: Request) => {
  try {
    const userId = request.headers.get("x-user-id")!;
    const body = await request.json();
    const parsed = tripSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { startDate, endDate, ...rest } = parsed.data;

    const trip = await prisma.trip.create({
      data: {
        ...rest,
        name: truncate(sanitizeHtml(rest.name), 200),
        ...(rest.notes ? { notes: truncate(sanitizeHtml(rest.notes), 5000) } : {}),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        userId,
      },
    });

    return NextResponse.json(trip, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
});
