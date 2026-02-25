import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, handleApiError } from "@/lib/api-errors";
import { resetPasswordSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/auth-utils";

/**
 * POST /api/auth/reset-password
 *
 * Validates the reset token and updates the user's password.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(400, parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { token, newPassword } = parsed.data;

    // Find the token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return apiError(400, "Invalid or expired reset token");
    }

    // Check expiry
    if (resetToken.expires < new Date()) {
      // Clean up expired token
      await prisma.passwordResetToken.delete({ where: { token } });
      return apiError(400, "Reset token has expired. Please request a new one.");
    }

    // Hash the new password
    const passwordHash = await hashPassword(newPassword);

    // Update password and delete the token in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { email: resetToken.email },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.delete({ where: { token } }),
    ]);

    return NextResponse.json({
      message: "Password has been reset successfully.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
