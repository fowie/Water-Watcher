import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { apiError, handleApiError } from "@/lib/api-errors";

/**
 * GET /api/user/notifications
 * Returns the user's notification preferences (creates defaults if none exist).
 */
export const GET = withAuth(async (request: Request) => {
  try {
    const userId = request.headers.get("x-user-id")!;

    let prefs = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    // Create default preferences if none exist
    if (!prefs) {
      prefs = await prisma.notificationPreference.create({
        data: {
          userId,
          channel: "push",
          dealAlerts: true,
          conditionAlerts: true,
          hazardAlerts: true,
          weeklyDigest: false,
        },
      });
    }

    return NextResponse.json(prefs);
  } catch (error) {
    return handleApiError(error);
  }
});

/**
 * PATCH /api/user/notifications
 * Updates the user's notification preferences.
 */
export const PATCH = withAuth(async (request: Request) => {
  try {
    const userId = request.headers.get("x-user-id")!;
    const body = await request.json();

    // Validate channel value if provided
    if (body.channel !== undefined) {
      const validChannels = ["push", "email", "both"];
      if (!validChannels.includes(body.channel)) {
        return apiError(400, `Invalid channel. Must be one of: ${validChannels.join(", ")}`);
      }
    }

    // Validate boolean fields
    const booleanFields = ["dealAlerts", "conditionAlerts", "hazardAlerts", "weeklyDigest"];
    for (const field of booleanFields) {
      if (body[field] !== undefined && typeof body[field] !== "boolean") {
        return apiError(400, `${field} must be a boolean`);
      }
    }

    // Build update data — only include provided fields
    const updateData: Record<string, unknown> = {};
    if (body.channel !== undefined) updateData.channel = body.channel;
    if (body.dealAlerts !== undefined) updateData.dealAlerts = body.dealAlerts;
    if (body.conditionAlerts !== undefined) updateData.conditionAlerts = body.conditionAlerts;
    if (body.hazardAlerts !== undefined) updateData.hazardAlerts = body.hazardAlerts;
    if (body.weeklyDigest !== undefined) updateData.weeklyDigest = body.weeklyDigest;

    if (Object.keys(updateData).length === 0) {
      return apiError(400, "No valid fields to update");
    }

    // Upsert — create with defaults if not exists, then apply update
    const prefs = await prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        channel: "push",
        dealAlerts: true,
        conditionAlerts: true,
        hazardAlerts: true,
        weeklyDigest: false,
        ...updateData,
      },
      update: updateData,
    });

    return NextResponse.json(prefs);
  } catch (error) {
    return handleApiError(error);
  }
});
