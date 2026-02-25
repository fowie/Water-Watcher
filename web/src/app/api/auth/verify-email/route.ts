import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handleApiError } from "@/lib/api-errors";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * GET /api/auth/verify-email?token=...
 *
 * Validates the verification token, marks the user's email as verified,
 * and redirects to the sign-in page with a success message.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(
        `${APP_URL}/auth/signin?error=Missing verification token`
      );
    }

    // Find the verification token
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      return NextResponse.redirect(
        `${APP_URL}/auth/signin?error=Invalid or expired verification token`
      );
    }

    // Check expiry
    if (verificationToken.expires < new Date()) {
      // Clean up expired token
      await prisma.verificationToken.delete({
        where: {
          identifier_token: {
            identifier: verificationToken.identifier,
            token: verificationToken.token,
          },
        },
      });
      return NextResponse.redirect(
        `${APP_URL}/auth/signin?error=Verification token has expired`
      );
    }

    // Update user's emailVerified timestamp
    await prisma.user.update({
      where: { email: verificationToken.identifier },
      data: { emailVerified: new Date() },
    });

    // Delete the used token
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: verificationToken.identifier,
          token: verificationToken.token,
        },
      },
    });

    return NextResponse.redirect(
      `${APP_URL}/auth/signin?message=Email verified successfully. You can now sign in.`
    );
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.redirect(
      `${APP_URL}/auth/signin?error=Verification failed. Please try again.`
    );
  }
}
