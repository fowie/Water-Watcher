import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { dealFilterUpdateSchema } from "@/lib/validations";
import { apiError, handleApiError } from "@/lib/api-errors";
import { withAuth, withApiRateLimit } from "@/lib/api-middleware";

export const GET = withAuth(async (
  request: Request,
  context?: unknown
) => {
  try {
    const { id } = await (context as { params: Promise<{ id: string }> }).params;
    const userId = request.headers.get("x-user-id")!;

    const filter = await prisma.dealFilter.findUnique({
      where: { id },
      include: {
        _count: { select: { matches: true } },
      },
    });

    if (!filter) {
      return apiError(404, "Deal filter not found");
    }

    // Only the owner can view their filter
    if (filter.userId !== userId) {
      return apiError(403, "Not authorized to view this filter");
    }

    return NextResponse.json(filter);
  } catch (error) {
    return handleApiError(error);
  }
});

export const PATCH = withApiRateLimit(withAuth(async (
  request: Request,
  context?: unknown
) => {
  try {
    const { id } = await (context as { params: Promise<{ id: string }> }).params;
    const userId = request.headers.get("x-user-id")!;
    const body = await request.json();

    // Validate the update payload
    const parsed = dealFilterUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Look up the filter
    const existing = await prisma.dealFilter.findUnique({ where: { id } });
    if (!existing) {
      return apiError(404, "Deal filter not found");
    }

    // Ownership check: session user must match the filter owner
    if (existing.userId !== userId) {
      return apiError(403, "Not authorized to update this filter");
    }

    const updated = await prisma.dealFilter.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}));

export const DELETE = withApiRateLimit(withAuth(async (
  request: Request,
  context?: unknown
) => {
  try {
    const { id } = await (context as { params: Promise<{ id: string }> }).params;
    const userId = request.headers.get("x-user-id")!;

    const existing = await prisma.dealFilter.findUnique({ where: { id } });
    if (!existing) {
      return apiError(404, "Deal filter not found");
    }

    // Ownership check
    if (existing.userId !== userId) {
      return apiError(403, "Not authorized to delete this filter");
    }

    await prisma.dealFilter.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}));
