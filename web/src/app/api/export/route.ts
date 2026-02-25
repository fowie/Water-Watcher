import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { apiError, handleApiError } from "@/lib/api-errors";

const exportQuerySchema = z.object({
  format: z.enum(["json", "csv", "gpx"]),
  type: z.enum(["rivers", "conditions", "deals", "all"]),
});

/**
 * GET /api/export
 * Export user's data in JSON, CSV, or GPX format.
 * Auth-protected: exports data for the authenticated user.
 */
export const GET = withAuth(async (request: Request) => {
  try {
    const userId = request.headers.get("x-user-id")!;
    const { searchParams } = new URL(request.url);

    const parsed = exportQuerySchema.safeParse({
      format: searchParams.get("format"),
      type: searchParams.get("type"),
    });

    if (!parsed.success) {
      return apiError(
        400,
        "Invalid query params. Required: format (json|csv|gpx), type (rivers|conditions|deals|all)"
      );
    }

    const { format, type } = parsed.data;

    // GPX only works with rivers (needs lat/lng)
    if (format === "gpx" && type !== "rivers" && type !== "all") {
      return apiError(400, "GPX format is only available for rivers or all data types");
    }

    // Fetch user's tracked rivers
    const trackedRiverIds = await prisma.userRiver.findMany({
      where: { userId },
      select: { riverId: true },
    });
    const riverIds = trackedRiverIds.map((ur) => ur.riverId);

    // Build data based on requested type
    const data = await fetchExportData(type, userId, riverIds);

    // Format and return
    switch (format) {
      case "json":
        return jsonExport(data, type);
      case "csv":
        return csvExport(data, type);
      case "gpx":
        return gpxExport(data, type);
      default:
        return apiError(400, "Unsupported format");
    }
  } catch (error) {
    return handleApiError(error);
  }
});

// ─── Data Fetching ────────────────────────────────────────

interface ExportData {
  rivers: ExportRiver[];
  conditions: ExportCondition[];
  deals: ExportDeal[];
}

interface ExportRiver {
  id: string;
  name: string;
  state: string;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  difficulty: string | null;
  description: string | null;
}

interface ExportCondition {
  id: string;
  riverId: string;
  riverName: string;
  flowRate: number | null;
  gaugeHeight: number | null;
  waterTemp: number | null;
  quality: string | null;
  runnability: string | null;
  source: string;
  scrapedAt: string;
}

interface ExportDeal {
  id: string;
  title: string;
  price: number | null;
  url: string;
  category: string | null;
  region: string | null;
  postedAt: string | null;
  scrapedAt: string;
}

async function fetchExportData(
  type: string,
  userId: string,
  riverIds: string[]
): Promise<ExportData> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result: ExportData = {
    rivers: [],
    conditions: [],
    deals: [],
  };

  if (type === "rivers" || type === "all") {
    const rivers = await prisma.river.findMany({
      where: { id: { in: riverIds } },
      select: {
        id: true,
        name: true,
        state: true,
        region: true,
        latitude: true,
        longitude: true,
        difficulty: true,
        description: true,
      },
      orderBy: { name: "asc" },
    });
    result.rivers = rivers;
  }

  if (type === "conditions" || type === "all") {
    const conditions = await prisma.riverCondition.findMany({
      where: {
        riverId: { in: riverIds },
        scrapedAt: { gte: thirtyDaysAgo },
      },
      include: {
        river: { select: { name: true } },
      },
      orderBy: { scrapedAt: "desc" },
    });
    result.conditions = conditions.map((c) => ({
      id: c.id,
      riverId: c.riverId,
      riverName: c.river.name,
      flowRate: c.flowRate,
      gaugeHeight: c.gaugeHeight,
      waterTemp: c.waterTemp,
      quality: c.quality,
      runnability: c.runnability,
      source: c.source,
      scrapedAt: c.scrapedAt.toISOString(),
    }));
  }

  if (type === "deals" || type === "all") {
    // Get user's deal filter matches
    const matchedDeals = await prisma.dealFilterMatch.findMany({
      where: {
        filter: { userId },
      },
      include: {
        deal: true,
      },
      orderBy: { createdAt: "desc" },
    });

    result.deals = matchedDeals.map((m) => ({
      id: m.deal.id,
      title: m.deal.title,
      price: m.deal.price,
      url: m.deal.url,
      category: m.deal.category,
      region: m.deal.region,
      postedAt: m.deal.postedAt?.toISOString() ?? null,
      scrapedAt: m.deal.scrapedAt.toISOString(),
    }));
  }

  return result;
}

// ─── JSON Export ──────────────────────────────────────────

function jsonExport(data: ExportData, type: string) {
  const exportPayload = type === "all" ? data : { [type]: data[type as keyof ExportData] };

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="water-watcher-${type}-export.json"`,
    },
  });
}

// ─── CSV Export ───────────────────────────────────────────

function csvExport(data: ExportData, type: string) {
  let csvContent = "";

  if (type === "rivers" || type === "all") {
    csvContent += "# Rivers\n";
    csvContent += "id,name,state,region,latitude,longitude,difficulty,description\n";
    for (const r of data.rivers) {
      csvContent += [
        csvEscape(r.id),
        csvEscape(r.name),
        csvEscape(r.state),
        csvEscape(r.region ?? ""),
        r.latitude ?? "",
        r.longitude ?? "",
        csvEscape(r.difficulty ?? ""),
        csvEscape(r.description ?? ""),
      ].join(",") + "\n";
    }
  }

  if (type === "conditions" || type === "all") {
    if (csvContent) csvContent += "\n";
    csvContent += "# Conditions (last 30 days)\n";
    csvContent += "id,river_id,river_name,flow_rate,gauge_height,water_temp,quality,runnability,source,scraped_at\n";
    for (const c of data.conditions) {
      csvContent += [
        csvEscape(c.id),
        csvEscape(c.riverId),
        csvEscape(c.riverName),
        c.flowRate ?? "",
        c.gaugeHeight ?? "",
        c.waterTemp ?? "",
        csvEscape(c.quality ?? ""),
        csvEscape(c.runnability ?? ""),
        csvEscape(c.source),
        csvEscape(c.scrapedAt),
      ].join(",") + "\n";
    }
  }

  if (type === "deals" || type === "all") {
    if (csvContent) csvContent += "\n";
    csvContent += "# Matched Deals\n";
    csvContent += "id,title,price,url,category,region,posted_at,scraped_at\n";
    for (const d of data.deals) {
      csvContent += [
        csvEscape(d.id),
        csvEscape(d.title),
        d.price ?? "",
        csvEscape(d.url),
        csvEscape(d.category ?? ""),
        csvEscape(d.region ?? ""),
        csvEscape(d.postedAt ?? ""),
        csvEscape(d.scrapedAt),
      ].join(",") + "\n";
    }
  }

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="water-watcher-${type}-export.csv"`,
    },
  });
}

/**
 * Escape a value for CSV. Wraps in quotes if it contains commas, quotes, or newlines.
 */
function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ─── GPX Export ───────────────────────────────────────────

function gpxExport(data: ExportData, type: string) {
  // GPX is only meaningful for rivers with lat/lng
  const waypoints = data.rivers.filter((r) => r.latitude !== null && r.longitude !== null);

  if (type !== "rivers" && type !== "all") {
    return apiError(400, "GPX format is only supported for rivers or all export types");
  }

  const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd"
     version="1.1"
     creator="Water Watcher">
  <metadata>
    <name>Water Watcher - Tracked Rivers</name>
    <desc>Exported river locations from Water Watcher</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
${waypoints
  .map(
    (r) => `  <wpt lat="${r.latitude}" lon="${r.longitude}">
    <name>${gpxEscape(r.name)}</name>
    <desc>${gpxEscape([r.state, r.region, r.difficulty].filter(Boolean).join(" | "))}</desc>
    <type>River</type>
  </wpt>`
  )
  .join("\n")}
</gpx>`;

  return new NextResponse(gpxContent, {
    status: 200,
    headers: {
      "Content-Type": "application/gpx+xml",
      "Content-Disposition": `attachment; filename="water-watcher-rivers.gpx"`,
    },
  });
}

/**
 * Escape XML special characters for GPX.
 */
function gpxEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
