import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { dealFilterSchema } from "@/lib/validations";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
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
    console.error("GET /api/deals/filters error:", error);
    return NextResponse.json(
      { error: "Failed to fetch deal filters" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, ...filterData } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    // Verify user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
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
    console.error("POST /api/deals/filters error:", error);
    return NextResponse.json(
      { error: "Failed to create deal filter" },
      { status: 500 }
    );
  }
}
