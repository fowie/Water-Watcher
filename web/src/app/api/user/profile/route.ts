import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, handleApiError } from "@/lib/api-errors";
import { withAuth } from "@/lib/api-middleware";

/**
 * GET /api/user/profile
 * Returns the authenticated user's profile including river and filter counts.
 */
export const GET = withAuth(async (request: Request) => {
  try {
    const userId = request.headers.get("x-user-id")!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        _count: {
          select: {
            trackedRivers: true,
            dealFilters: true,
          },
        },
      },
    });

    if (!user) {
      return apiError(404, "User not found");
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      riverCount: user._count.trackedRivers,
      filterCount: user._count.dealFilters,
    });
  } catch (error) {
    return handleApiError(error);
  }
});

/**
 * PATCH /api/user/profile
 * Update the authenticated user's name and/or email.
 * Checks for duplicate email before updating.
 */
export const PATCH = withAuth(async (request: Request) => {
  try {
    const userId = request.headers.get("x-user-id")!;
    const body = await request.json();

    const { name, email } = body;

    // Validate at least one field is provided
    if (name === undefined && email === undefined) {
      return apiError(400, "At least one of 'name' or 'email' must be provided");
    }

    // Validate name if provided
    if (name !== undefined && typeof name !== "string") {
      return apiError(400, "Name must be a string");
    }
    if (typeof name === "string" && name.trim().length === 0) {
      return apiError(400, "Name cannot be empty");
    }

    // Validate email if provided
    if (email !== undefined && typeof email !== "string") {
      return apiError(400, "Email must be a string");
    }
    if (typeof email === "string") {
      // Basic email format check
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return apiError(400, "Invalid email format");
      }

      // Check for duplicate email
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existing && existing.id !== userId) {
        return apiError(409, "Email is already in use");
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;

    const updated = await prisma.user.update({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        _count: {
          select: {
            trackedRivers: true,
            dealFilters: true,
          },
        },
      },
      data: updateData,
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      createdAt: updated.createdAt,
      riverCount: updated._count.trackedRivers,
      filterCount: updated._count.dealFilters,
    });
  } catch (error) {
    return handleApiError(error);
  }
});
