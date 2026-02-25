import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { riverUpdateSchema } from "@/lib/validations";
import { apiError, handleApiError } from "@/lib/api-errors";
import { withAuth } from "@/lib/api-middleware";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const river = await prisma.river.findUnique({
      where: { id },
      include: {
        conditions: {
          orderBy: { scrapedAt: "desc" },
          take: 20,
        },
        hazards: {
          where: { isActive: true },
          orderBy: { reportedAt: "desc" },
        },
        campsites: true,
        rapids: {
          orderBy: { mile: "asc" },
        },
        _count: {
          select: { trackedBy: true },
        },
      },
    });

    if (!river) {
      return apiError(404, "River not found");
    }

    return NextResponse.json(river);
  } catch (error) {
    return handleApiError(error);
  }
}

export const PATCH = withAuth(async (
  request: Request,
  context?: unknown
) => {
  try {
    const { id } = await (context as { params: Promise<{ id: string }> }).params;
    const body = await request.json();

    const parsed = riverUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.river.findUnique({ where: { id } });
    if (!existing) {
      return apiError(404, "River not found");
    }

    const updated = await prisma.river.update({
      where: { id },
      data: parsed.data,
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

    const existing = await prisma.river.findUnique({ where: { id } });
    if (!existing) {
      return apiError(404, "River not found");
    }

    await prisma.river.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
});
