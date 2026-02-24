import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { dealFilterUpdateSchema } from "@/lib/validations";
import { apiError, handleApiError } from "@/lib/api-errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const filter = await prisma.dealFilter.findUnique({
      where: { id },
      include: {
        _count: { select: { matches: true } },
      },
    });

    if (!filter) {
      return apiError(404, "Deal filter not found");
    }

    return NextResponse.json(filter);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Ownership check: userId must be provided and must match the filter owner
    const userId = body.userId;
    if (!userId) {
      return apiError(400, "userId is required");
    }
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
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.dealFilter.findUnique({ where: { id } });
    if (!existing) {
      return apiError(404, "Deal filter not found");
    }

    await prisma.dealFilter.delete({ where: { id } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
}
