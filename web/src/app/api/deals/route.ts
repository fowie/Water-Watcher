import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const maxPrice = searchParams.get("maxPrice");
    const region = searchParams.get("region");
    const search = searchParams.get("search");
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") ?? "50"), 1),
      100
    );
    const offset = Math.max(parseInt(searchParams.get("offset") ?? "0"), 0);

    const where: Record<string, unknown> = { isActive: true };
    if (category) where.category = category;
    if (region) where.region = region;
    if (maxPrice) {
      const price = parseFloat(maxPrice);
      if (!isNaN(price) && price > 0) {
        where.price = { lte: price };
      }
    }
    if (search) {
      where.title = { contains: search, mode: "insensitive" };
    }

    const [deals, total] = await Promise.all([
      prisma.gearDeal.findMany({
        where,
        orderBy: { scrapedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.gearDeal.count({ where }),
    ]);

    return NextResponse.json({ deals, total, limit, offset });
  } catch (error) {
    console.error("GET /api/deals error:", error);
    return NextResponse.json(
      { error: "Failed to fetch deals" },
      { status: 500 }
    );
  }
}
