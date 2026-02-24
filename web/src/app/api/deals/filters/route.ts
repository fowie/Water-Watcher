import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { dealFilterSchema } from "@/lib/validations";
import { apiError, handleApiError } from "@/lib/api-errors";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return apiError(400, "userId is required");
    }

    const filters = await prisma.dealFilter.findMany({
      where: { userId },
      include: {
        _count: { select: { matches: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(filters);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, ...filterData } = body;

    if (!userId) {
      return apiError(400, "userId is required");
    }

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return apiError(404, "User not found");
    }

    const parsed = dealFilterSchema.safeParse(filterData);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const filter = await prisma.dealFilter.create({
      data: {
        ...parsed.data,
        userId,
      },
    });

    return NextResponse.json(filter, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
