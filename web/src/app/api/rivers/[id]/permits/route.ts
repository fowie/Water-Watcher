import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, handleApiError } from "@/lib/api-errors";

/**
 * GET /api/rivers/[id]/permits — get permit requirements for a river
 */
export async function GET(
  _request: Request,
  context?: unknown
) {
  try {
    const { id } = await (context as { params: Promise<{ id: string }> }).params;

    const river = await prisma.river.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        permitRequired: true,
        permitInfo: true,
        permitUrl: true,
      },
    });

    if (!river) {
      return apiError(404, "River not found");
    }

    return NextResponse.json({
      riverId: river.id,
      riverName: river.name,
      required: river.permitRequired,
      permitRequired: river.permitRequired,
      permitInfo: river.permitInfo,
      permitUrl: river.permitUrl,
      url: river.permitUrl,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
