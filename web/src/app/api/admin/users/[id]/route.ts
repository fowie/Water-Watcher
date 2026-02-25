import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, handleApiError } from "@/lib/api-errors";
import { requireAdmin, isAdminError } from "@/lib/admin";
import { z } from "zod";

const updateUserRoleSchema = z.object({
  role: z.enum(["user", "admin"], {
    errorMap: () => ({ message: 'Role must be "user" or "admin"' }),
  }),
});

/**
 * PATCH /api/admin/users/[id] — Update a user's role (admin only)
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const adminResult = await requireAdmin();
  if (isAdminError(adminResult)) return adminResult;

  try {
    const { id } = await context.params;
    const body = await request.json();

    const parsed = updateUserRoleSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(400, parsed.error.errors[0]?.message ?? "Invalid input");
    }

    // Prevent admin from demoting themselves
    if (id === adminResult.user.id && parsed.data.role !== "admin") {
      return apiError(400, "Cannot remove your own admin role");
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return apiError(404, "User not found");
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role: parsed.data.role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        image: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
