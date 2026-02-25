import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { dealFilterSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/api-errors";
import { withAuth } from "@/lib/api-middleware";

export const GET = withAuth(async (request: Request) => {
  try {
    const userId = request.headers.get("x-user-id")!;

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
});

export const POST = withAuth(async (request: Request) => {
  try {
    const userId = request.headers.get("x-user-id")!;
    const body = await request.json();

    const parsed = dealFilterSchema.safeParse(body);
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
});
