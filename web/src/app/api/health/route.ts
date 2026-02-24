import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const timestamp = new Date().toISOString();
  const version = "0.1.0";

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", timestamp, version });
  } catch {
    return NextResponse.json(
      { status: "degraded", timestamp, version },
      { status: 503 }
    );
  }
}
