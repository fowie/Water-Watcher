import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/api-errors";
import { requireAdmin, isAdminError } from "@/lib/admin";

/**
 * POST /api/admin/users — List users with search and pagination (admin only)
 * Using POST to allow a request body with search/pagination params.
 */
export async function POST(request: NextRequest) {
  const adminResult = await requireAdmin();
  if (isAdminError(adminResult)) return adminResult;

  try {
    const body = await request.json().catch(() => ({}));
    const search = typeof body.search === "string" ? body.search.trim() : "";
    const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 100);
    const offset = Math.max(Number(body.offset) || 0, 0);

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          image: true,
          emailVerified: true,
          createdAt: true,
          _count: {
            select: {
              trackedRivers: true,
              trips: true,
              reviews: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        image: u.image,
        emailVerified: u.emailVerified,
        createdAt: u.createdAt,
        riverCount: u._count.trackedRivers,
        tripCount: u._count.trips,
        reviewCount: u._count.reviews,
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
