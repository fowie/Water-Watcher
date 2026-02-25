import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, handleApiError } from "@/lib/api-errors";
import { auth } from "@/lib/auth";

const searchParamsSchema = z.object({
  q: z.string().min(1, "Search term is required"),
  type: z.enum(["rivers", "deals", "trips", "reviews", "all"]).default("all"),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

interface SearchResultItem {
  type: "river" | "deal" | "trip" | "review";
  id: string;
  title: string;
  subtitle: string;
  url: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = searchParamsSchema.safeParse({
      q: searchParams.get("q"),
      type: searchParams.get("type") ?? "all",
      limit: searchParams.get("limit") ?? "10",
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { q, type, limit } = parsed.data;

    // Check auth for trips
    let userId: string | null = null;
    const session = await auth();
    if (session?.user?.id) {
      userId = session.user.id;
    }

    const rivers: SearchResultItem[] = [];
    const deals: SearchResultItem[] = [];
    const trips: SearchResultItem[] = [];
    const reviews: SearchResultItem[] = [];

    // Search rivers (public)
    if (type === "all" || type === "rivers") {
      const riverResults = await prisma.river.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { state: { contains: q, mode: "insensitive" } },
            { region: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, state: true, difficulty: true },
        take: limit,
        orderBy: { name: "asc" },
      });

      for (const r of riverResults) {
        rivers.push({
          type: "river",
          id: r.id,
          title: r.name,
          subtitle: `${r.state}${r.difficulty ? ` · ${r.difficulty}` : ""}`,
          url: `/rivers/${r.id}`,
        });
      }
    }

    // Search deals (public, only active)
    if (type === "all" || type === "deals") {
      const dealResults = await prisma.gearDeal.findMany({
        where: {
          isActive: true,
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { category: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, title: true, price: true, category: true },
        take: limit,
        orderBy: { scrapedAt: "desc" },
      });

      for (const d of dealResults) {
        deals.push({
          type: "deal",
          id: d.id,
          title: d.title,
          subtitle: `${d.category ?? "Gear"}${d.price != null ? ` · $${d.price}` : ""}`,
          url: `/deals`,
        });
      }
    }

    // Search trips (auth required, user's own only)
    if (type === "all" || type === "trips") {
      if (!userId) {
        if (type === "trips") {
          return apiError(401, "Authentication required to search trips");
        }
        // For "all" type, just skip trips silently
      } else {
        const tripResults = await prisma.trip.findMany({
          where: {
            userId,
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { notes: { contains: q, mode: "insensitive" } },
            ],
          },
          select: { id: true, name: true, startDate: true, status: true },
          take: limit,
          orderBy: { startDate: "desc" },
        });

        for (const t of tripResults) {
          trips.push({
            type: "trip",
            id: t.id,
            title: t.name,
            subtitle: `${t.status} · ${new Date(t.startDate).toLocaleDateString()}`,
            url: `/trips/${t.id}`,
          });
        }
      }
    }

    // Search reviews (public, include river name)
    if (type === "all" || type === "reviews") {
      const reviewResults = await prisma.riverReview.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { body: { contains: q, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          title: true,
          rating: true,
          riverId: true,
          river: { select: { name: true } },
        },
        take: limit,
        orderBy: { createdAt: "desc" },
      });

      for (const rv of reviewResults) {
        reviews.push({
          type: "review",
          id: rv.id,
          title: rv.title ?? `${rv.rating}-star review`,
          subtitle: rv.river.name,
          url: `/rivers/${rv.riverId}`,
        });
      }
    }

    const totalResults = rivers.length + deals.length + trips.length + reviews.length;

    return NextResponse.json({
      rivers,
      deals,
      trips,
      reviews,
      totalResults,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
