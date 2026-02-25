import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { riverSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/api-errors";
import { withAuth } from "@/lib/api-middleware";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get("state");
    const search = searchParams.get("search");
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") ?? "50"), 1),
      100
    );
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0"), 0);

    const where: Record<string, unknown> = {};
    if (state) where.state = state;
    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    const [rivers, total] = await Promise.all([
      prisma.river.findMany({
        where,
        include: {
          conditions: {
            orderBy: { scrapedAt: "desc" },
            take: 1,
          },
          hazards: {
            where: { isActive: true },
            orderBy: { reportedAt: "desc" },
            take: 3,
          },
          _count: {
            select: { trackedBy: true },
          },
        },
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.river.count({ where }),
    ]);

    return NextResponse.json({ rivers, total, limit, offset });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withAuth(async (request: Request) => {
  try {
    const body = await request.json();
    const parsed = riverSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const river = await prisma.river.create({
      data: parsed.data,
    });

    return NextResponse.json(river, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
});
