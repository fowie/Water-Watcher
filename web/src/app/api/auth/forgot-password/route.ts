import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { apiError, handleApiError } from "@/lib/api-errors";
import { forgotPasswordSchema } from "@/lib/validations";
import { sendPasswordResetEmail } from "@/lib/email";

/**
 * POST /api/auth/forgot-password
 *
 * Initiates password reset flow. Always returns 200 to prevent email enumeration.
 * Only generates a token for users with a passwordHash (credentials users).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(400, "Invalid email address");
    }

    const { email } = parsed.data;

    // Look up user — only credentials users (with passwordHash) are eligible
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });

    if (user?.passwordHash) {
      // Generate a secure random token
      const token = randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Delete any existing tokens for this email
      await prisma.passwordResetToken.deleteMany({
        where: { email },
      });

      // Create new token
      await prisma.passwordResetToken.create({
        data: {
          email,
          token,
          expires,
        },
      });

      // Send email (no-op if RESEND_API_KEY not configured)
      await sendPasswordResetEmail(email, token);
    }

    // Always return 200 to prevent email enumeration
    return NextResponse.json({
      message: "If an account exists with that email, a reset link has been sent.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
