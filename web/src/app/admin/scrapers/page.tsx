"use client";

import { useState, useEffect, useCallback } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, timeAgo } from "@/lib/utils";
import {
  getScraperStats,
  getScraperDetail,
  type ScraperStat,
  type ScraperStatsResponse,
  type ScraperDetailResponse,
  type ScraperLogEntry,
} from "@/lib/api";
import {
  Activity,
  Droplets,
  Mountain,
  ShoppingBag,
  TreePine,
  Landmark,
  Waves,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  Camera,
} from "lucide-react";

const SOURCE_CONFIG: Record<
  string,
  { label: string; icon: typeof Mountain; emoji: string; interval: number }
> = {
  usgs: { label: "USGS", icon: Droplets, emoji: "🌊", interval: 4 * 60 },
  aw: { label: "American Whitewater", icon: Waves, emoji: "🛶", interval: 4 * 60 },
  craigslist: { label: "Craigslist", icon: ShoppingBag, emoji: "🏷️", interval: 30 },
  blm: { label: "BLM", icon: Landmark, emoji: "🏜️", interval: 6 * 60 },
  usfs: { label: "USFS", icon: TreePine, emoji: "🌲", interval: 6 * 60 },
};

function getStatusColor(lastScrapeAt: string | null, intervalMinutes: number): "green" | "yellow" | "red" {
  if (!lastScrapeAt) return "red";
  const diffMs = Date.now() - new Date(lastScrapeAt).getTime();
  const diffMinutes = diffMs / (1000 * 60);
  if (diffMinutes < intervalMinutes * 2) return "green";
  if (diffMinutes < intervalMinutes * 3) return "yellow";
  return "red";
}

const STATUS_DOT: Record<string, string> = {
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
};

const STATUS_LABEL: Record<string, string> = {
  green: "Healthy",
  yellow: "Delayed",
  red: "Error",
};

function AdminScrapersContent() {
  const [stats, setStats] = useState<ScraperStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [detail, setDetail] = useState<ScraperDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const data = await getScraperStats();
      setStats(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleExpand = useCallback(
    async (source: string) => {
      if (expandedSource === source) {
        setExpandedSource(null);
        setDetail(null);
        return;
      }
      setExpandedSource(source);
      setDetailLoading(true);
      try {
        const data = await getScraperDetail(source);
        setDetail(data);
      } catch {
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [expandedSource]
  );

  if (loading) {
    return (
      <main className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      </main>
    );
  }

  const scrapers = stats?.scrapers ?? [];
  const summary = stats?.summary;

  return (
    <main className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Activity className="h-7 w-7 text-[var(--primary)]" aria-hidden="true" />
          Scrape Monitor
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Monitor scraper health and data collection
        </p>
      </div>

      {/* System stats row */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard label="Total Rivers" value={summary.totalRiversTracked} icon={<Mountain className="h-4 w-4" />} />
          <SummaryCard label="Conditions (24h)" value={summary.conditionsLast24h} icon={<Droplets className="h-4 w-4" />} />
          <SummaryCard label="Active Hazards" value={summary.activeHazards} icon={<AlertTriangle className="h-4 w-4" />} />
          <SummaryCard label="Sources" value={scrapers.length} icon={<Activity className="h-4 w-4" />} />
        </div>
      )}

      {/* Scraper overview cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {scrapers.map((scraper) => {
          const config = SOURCE_CONFIG[scraper.source] ?? {
            label: scraper.source,
            icon: Activity,
            emoji: "📡",
            interval: 240,
          };
          const status = getStatusColor(
            scraper.lastScrapeAt,
            config.interval
          );
          const Icon = config.icon;
          const isExpanded = expandedSource === scraper.source;
          const successRate =
            scraper.totalScrapes24h > 0
              ? Math.round(
                  (scraper.successCount24h / scraper.totalScrapes24h) * 100
                )
              : 0;

          return (
            <div key={scraper.source}>
              <Card
                className={cn(
                  "cursor-pointer transition-colors hover:border-[var(--primary)]",
                  isExpanded && "border-[var(--primary)]"
                )}
                onClick={() => handleExpand(scraper.source)}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{config.emoji}</span>
                      <span className="font-semibold text-sm">
                        {config.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          STATUS_DOT[status]
                        )}
                        title={STATUS_LABEL[status]}
                      />
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-[var(--muted-foreground)]" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-[var(--muted-foreground)]" />
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[var(--muted-foreground)]">
                        Last scrape
                      </span>
                      <p className="font-medium">
                        {scraper.lastScrapeAt
                          ? timeAgo(scraper.lastScrapeAt)
                          : "Never"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[var(--muted-foreground)]">
                        Status
                      </span>
                      <p className="font-medium">
                        <span
                          className={cn(
                            status === "green" && "text-green-600",
                            status === "yellow" && "text-yellow-600",
                            status === "red" && "text-red-600"
                          )}
                        >
                          {STATUS_LABEL[status]}
                        </span>
                      </p>
                    </div>
                    <div>
                      <span className="text-[var(--muted-foreground)]">
                        24h runs
                      </span>
                      <p className="font-medium">
                        {scraper.totalScrapes24h}
                      </p>
                    </div>
                    <div>
                      <span className="text-[var(--muted-foreground)]">
                        Success
                      </span>
                      <p className="font-medium">{successRate}%</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[var(--muted-foreground)]">
                        Items scraped (24h)
                      </span>
                      <p className="font-medium">
                        {scraper.itemsScraped24h.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Expanded detail */}
              {isExpanded && (
                <Card className="mt-2 border-[var(--primary)]/30">
                  <CardContent className="p-4">
                    {detailLoading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Skeleton key={i} className="h-10 w-full" />
                        ))}
                      </div>
                    ) : detail ? (
                      <div className="space-y-4">
                        {/* Detail stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-[var(--muted-foreground)]">
                              Total scrapes
                            </span>
                            <p className="font-semibold">
                              {detail.stats.totalScrapes}
                            </p>
                          </div>
                          <div>
                            <span className="text-[var(--muted-foreground)]">
                              Success rate
                            </span>
                            <p className="font-semibold">
                              {Math.round(detail.stats.successRate)}%
                            </p>
                          </div>
                          <div>
                            <span className="text-[var(--muted-foreground)]">
                              Avg items/run
                            </span>
                            <p className="font-semibold">
                              {detail.stats.avgItemsPerRun.toFixed(1)}
                            </p>
                          </div>
                          <div>
                            <span className="text-[var(--muted-foreground)]">
                              Avg duration
                            </span>
                            <p className="font-semibold">
                              {detail.stats.avgDurationMs != null
                                ? `${(detail.stats.avgDurationMs / 1000).toFixed(1)}s`
                                : "N/A"}
                            </p>
                          </div>
                        </div>

                        {/* Scrape history */}
                        <div className="space-y-1">
                          <h3 className="text-sm font-semibold">
                            Scrape History
                          </h3>
                          <div className="divide-y divide-[var(--border)] max-h-64 overflow-y-auto">
                            {detail.logs.length === 0 && (
                              <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">
                                No scrape history available
                              </p>
                            )}
                            {detail.logs.slice(0, 50).map((log) => (
                              <div
                                key={log.id}
                                className="flex items-center gap-3 py-2 text-xs"
                              >
                                {/* Status icon */}
                                {log.status === "success" ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" aria-hidden="true" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-600 shrink-0" aria-hidden="true" />
                                )}

                                {/* Timestamp */}
                                <span className="text-[var(--muted-foreground)] whitespace-nowrap">
                                  {timeAgo(log.startedAt)}
                                </span>

                                {/* Status badge */}
                                <Badge
                                  variant={
                                    log.status === "success"
                                      ? "default"
                                      : "destructive"
                                  }
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {log.status}
                                </Badge>

                                {/* Items */}
                                <span className="font-medium">
                                  {log.itemCount} items
                                </span>

                                {/* Duration */}
                                {log.duration != null && (
                                  <span className="text-[var(--muted-foreground)]">
                                    {(log.duration / 1000).toFixed(1)}s
                                  </span>
                                )}

                                {/* Error */}
                                {log.error && (
                                  <span
                                    className="text-[var(--destructive)] truncate max-w-[200px]"
                                    title={log.error}
                                  >
                                    {log.error}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--muted-foreground)] text-center py-4">
                        Failed to load details
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          );
        })}
      </div>

      {scrapers.length === 0 && !loading && (
        <div className="text-center py-16">
          <Activity className="h-10 w-10 mx-auto text-[var(--muted-foreground)] mb-4" />
          <p className="text-[var(--muted-foreground)]">No scraper data available</p>
        </div>
      )}
    </main>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className="rounded-md bg-[var(--muted)] p-2">{icon}</div>
        <div>
          <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
          <p className="text-lg font-bold">{value.toLocaleString()}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminScrapersPage() {
  return (
    <AuthGuard>
      <AdminScrapersContent />
    </AuthGuard>
  );
}
