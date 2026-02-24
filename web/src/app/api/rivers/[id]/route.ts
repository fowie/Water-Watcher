import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const river = await prisma.river.findUnique({
      where: { id },
      include: {
        conditions: {
          orderBy: { scrapedAt: "desc" },
          take: 20,
        },
        hazards: {
          where: { isActive: true },
          orderBy: { reportedAt: "desc" },
        },
        campsites: true,
        rapids: {
          orderBy: { mile: "asc" },
        },
        _count: {
          select: { trackedBy: true },
        },
      },
    });

    if (!river) {
      return NextResponse.json({ error: "River not found" }, { status: 404 });
    }

    return NextResponse.json(river);
  } catch (error) {
    console.error("GET /api/rivers/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch river" },
      { status: 500 }
    );
  }
}
