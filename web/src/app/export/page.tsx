"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AuthGuard } from "@/components/auth-guard";
import { getRivers, getDeals } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  Map,
  Loader2,
  CheckCircle2,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ExportFormat = "json" | "csv" | "gpx";
type ExportType = "rivers" | "conditions" | "deals" | "all";

const FORMAT_OPTIONS: { value: ExportFormat; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: "json",
    label: "JSON",
    icon: <FileJson className="h-5 w-5" aria-hidden="true" />,
    description: "Full data backup, ideal for developers and data analysis tools.",
  },
  {
    value: "csv",
    label: "CSV",
    icon: <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />,
    description: "Spreadsheet-compatible format. Open in Excel, Google Sheets, or Numbers.",
  },
  {
    value: "gpx",
    label: "GPX",
    icon: <Map className="h-5 w-5" aria-hidden="true" />,
    description: "GPS Exchange format. Load river waypoints into Garmin, Gaia GPS, or other GPS apps.",
  },
];

const TYPE_OPTIONS: { value: ExportType; label: string; description: string }[] = [
  { value: "rivers", label: "Rivers", description: "All tracked rivers with coordinates and details" },
  { value: "conditions", label: "Conditions", description: "Recent water conditions (flow, gauge height, temp)" },
  { value: "deals", label: "Deals", description: "Gear deals and marketplace listings" },
  { value: "all", label: "All Data", description: "Complete export of all Water-Watcher data" },
];

function getFileExtension(format: ExportFormat): string {
  return format;
}

function getMimeType(format: ExportFormat): string {
  switch (format) {
    case "json": return "application/json";
    case "csv": return "text/csv";
    case "gpx": return "application/gpx+xml";
  }
}

export default function ExportPage() {
  const [format, setFormat] = useState<ExportFormat>("json");
  const [type, setType] = useState<ExportType>("rivers");
  const [exporting, setExporting] = useState(false);
  const [riverCount, setRiverCount] = useState<number | null>(null);
  const [dealCount, setDealCount] = useState<number | null>(null);
  const { toast } = useToast();

  // Load counts for size estimation
  const loadCounts = useCallback(async () => {
    try {
      const [riversData, dealsData] = await Promise.allSettled([
        getRivers({ limit: 1 }),
        getDeals({ limit: 1 }),
      ]);
      if (riversData.status === "fulfilled") setRiverCount(riversData.value.total);
      if (dealsData.status === "fulfilled") setDealCount(dealsData.value.total);
    } catch {
      // counts are optional
    }
  }, []);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const gpxDisabled = format === "gpx" && type !== "rivers";
  const canExport = !exporting && !gpxDisabled;

  const estimatedRecords = (() => {
    switch (type) {
      case "rivers": return riverCount;
      case "conditions": return riverCount != null ? riverCount * 20 : null; // ~20 conditions per river
      case "deals": return dealCount;
      case "all": {
        if (riverCount == null && dealCount == null) return null;
        return (riverCount ?? 0) + (riverCount ?? 0) * 20 + (dealCount ?? 0);
      }
    }
  })();

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/export?format=${format}&type=${type}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Export failed: ${res.status}`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `water-watcher-${type}-${new Date().toISOString().slice(0, 10)}.${getFileExtension(format)}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export complete",
        description: `Your ${type} data has been exported as ${format.toUpperCase()}.`,
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "An error occurred during export.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }, [format, type, toast]);

  return (
    <AuthGuard>
      <main className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold">Export Data</h1>
          <p className="text-[var(--muted-foreground)]">
            Download your Water-Watcher data in your preferred format.
          </p>
        </div>

        {/* Format selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Format</CardTitle>
            <CardDescription>Choose the file format for your export.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {FORMAT_OPTIONS.map((opt) => {
                const isGpxDisabled = opt.value === "gpx" && type !== "rivers";
                return (
                  <button
                    key={opt.value}
                    onClick={() => !isGpxDisabled && setFormat(opt.value)}
                    disabled={isGpxDisabled}
                    className={cn(
                      "relative rounded-lg border-2 p-4 text-left transition-all",
                      format === opt.value
                        ? "border-[var(--primary)] bg-[var(--primary)]/5"
                        : "border-[var(--border)] hover:border-[var(--primary)]/50",
                      isGpxDisabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {format === opt.value && (
                      <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
                    )}
                    <div className="flex items-center gap-2 mb-2">
                      {opt.icon}
                      <span className="font-semibold">{opt.label}</span>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {opt.description}
                    </p>
                    {isGpxDisabled && (
                      <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
                        <Info className="h-3 w-3" aria-hidden="true" />
                        GPX requires &ldquo;Rivers&rdquo; type
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Type selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Data Type</CardTitle>
            <CardDescription>Select which data to include in the export.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setType(opt.value);
                    // Auto-switch from GPX if user selects non-rivers type
                    if (format === "gpx" && opt.value !== "rivers") {
                      setFormat("json");
                    }
                  }}
                  className={cn(
                    "relative rounded-lg border-2 p-4 text-left transition-all",
                    type === opt.value
                      ? "border-[var(--primary)] bg-[var(--primary)]/5"
                      : "border-[var(--border)] hover:border-[var(--primary)]/50"
                  )}
                >
                  {type === opt.value && (
                    <CheckCircle2 className="absolute top-2 right-2 h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
                  )}
                  <span className="font-semibold text-sm">{opt.label}</span>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    {opt.description}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Summary & Export button */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Export <Badge variant="secondary">{type}</Badge> as{" "}
                  <Badge variant="secondary">{format.toUpperCase()}</Badge>
                </p>
                {estimatedRecords != null && (
                  <p className="text-xs text-[var(--muted-foreground)]">
                    ~{estimatedRecords.toLocaleString()} record{estimatedRecords !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
              <Button
                onClick={handleExport}
                disabled={!canExport}
                className="gap-2"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="h-4 w-4" aria-hidden="true" />
                )}
                {exporting ? "Exporting…" : "Export"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </AuthGuard>
  );
}
