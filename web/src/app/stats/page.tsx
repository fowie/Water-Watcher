"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthGuard } from "@/components/auth-guard";
import { StarRating } from "@/components/river-reviews";
import {
  Mountain,
  AlertTriangle,
  ShoppingBag,
  MessageSquare,
  Compass,
  Activity,
  Droplets,
  Clock,
  BarChart3,
  Star,
  TrendingUp,
  ShieldAlert,
} from "lucide-react";
import {
  getRivers,
  getDeals,
  getTrips,
  getAlerts,
  getTrackedRivers,
  getDealFilters,
  getRiverReviews,
  getActiveSafetyAlerts,
} from "@/lib/api";
import { useSession } from "next-auth/react";
import { timeAgo, cn } from "@/lib/utils";
import Link from "next/link";
import type { AlertLogRecord, ActiveSafetyAlertRecord } from "@/lib/api";

function StatsContent() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);

  // Summary stats
  const [totalRivers, setTotalRivers] = useState(0);
  const [activeHazards, setActiveHazards] = useState(0);
  const [totalDeals, setTotalDeals] = useState(0);
  const [totalTrips, setTotalTrips] = useState(0);
  const [trackedCount, setTrackedCount] = useState(0);

  // Activity feed
  const [recentActivity, setRecentActivity] = useState<AlertLogRecord[]>([]);

  // Condition quality breakdown
  const [qualityBreakdown, setQualityBreakdown] = useState<Record<string, number>>({});

  // User stats
  const [filterCount, setFilterCount] = useState(0);

  // Safety alerts
  const [safetyAlertCount, setSafetyAlertCount] = useState(0);
  const [criticalAlerts, setCriticalAlerts] = useState<ActiveSafetyAlertRecord[]>([]);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        getRivers({ limit: 100 }),
        getDeals({ limit: 1 }),
        getTrips(),
        getAlerts({ limit: 10 }),
        getTrackedRivers(),
        session?.user?.id ? getDealFilters(session.user.id) : Promise.resolve([]),
        getActiveSafetyAlerts({ limit: 10, severity: "CRITICAL" }).catch(() => null),
        getActiveSafetyAlerts({ limit: 1 }).catch(() => null),
      ]);

      // Rivers
      if (results[0].status === "fulfilled") {
        const riversData = results[0].value;
        setTotalRivers(riversData.total);
        // Compute hazard + quality from the summary data
        let hazards = 0;
        const qBreakdown: Record<string, number> = {
          excellent: 0,
          good: 0,
          fair: 0,
          poor: 0,
          dangerous: 0,
          unknown: 0,
        };
        for (const r of riversData.rivers) {
          hazards += r.activeHazardCount;
          const q = r.latestCondition?.quality ?? "unknown";
          qBreakdown[q] = (qBreakdown[q] ?? 0) + 1;
        }
        setActiveHazards(hazards);
        setQualityBreakdown(qBreakdown);
      }

      // Deals
      if (results[1].status === "fulfilled") {
        setTotalDeals(results[1].value.total);
      }

      // Trips
      if (results[2].status === "fulfilled") {
        setTotalTrips(results[2].value.trips.length);
      }

      // Activity feed
      if (results[3].status === "fulfilled") {
        setRecentActivity(results[3].value.alerts);
      }

      // Tracked rivers
      if (results[4].status === "fulfilled") {
        setTrackedCount(results[4].value.rivers.length);
      }

      // Critical safety alerts
      if (results[6].status === "fulfilled" && results[6].value) {
        const safetyData = results[6].value as { alerts: ActiveSafetyAlertRecord[] };
        setCriticalAlerts(safetyData.alerts ?? []);
      }

      // Total safety alert count
      if (results[7].status === "fulfilled" && results[7].value) {
        const totalSafety = results[7].value as { total: number };
        setSafetyAlertCount(totalSafety.total ?? 0);
      }

      // Deal filters
      if (results[5].status === "fulfilled") {
        const filters = results[5].value;
        setFilterCount(Array.isArray(filters) ? filters.length : 0);
      }
    } catch {
      // Silently fail — individual sections handle their empties
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <main className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </main>
    );
  }

  const QUALITY_COLORS: Record<string, string> = {
    excellent: "#22c55e",
    good: "#3b82f6",
    fair: "#eab308",
    poor: "#f97316",
    dangerous: "#ef4444",
    unknown: "#9ca3af",
  };

  // Build conic-gradient for donut chart
  const totalQuality = Object.values(qualityBreakdown).reduce((a, b) => a + b, 0);
  let cumPct = 0;
  const gradientStops: string[] = [];
  for (const [quality, count] of Object.entries(qualityBreakdown)) {
    if (count === 0) continue;
    const pct = (count / Math.max(totalQuality, 1)) * 100;
    gradientStops.push(`${QUALITY_COLORS[quality] ?? "#9ca3af"} ${cumPct}% ${cumPct + pct}%`);
    cumPct += pct;
  }

  const activityIcons: Record<string, { icon: React.ReactNode; color: string }> = {
    deal: { icon: <ShoppingBag className="h-4 w-4" />, color: "text-blue-600 bg-blue-100 dark:bg-blue-900" },
    condition: { icon: <Droplets className="h-4 w-4" />, color: "text-green-600 bg-green-100 dark:bg-green-900" },
    hazard: { icon: <AlertTriangle className="h-4 w-4" />, color: "text-red-600 bg-red-100 dark:bg-red-900" },
    digest: { icon: <Activity className="h-4 w-4" />, color: "text-purple-600 bg-purple-100 dark:bg-purple-900" },
  };

  return (
    <main className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Stats Dashboard</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Overview of your Water-Watcher data
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard icon={<Mountain className="h-5 w-5" />} label="Total Rivers" value={totalRivers} />
        <SummaryCard icon={<AlertTriangle className="h-5 w-5" />} label="Active Hazards" value={activeHazards} valueColor={activeHazards > 0 ? "text-red-600" : undefined} />
        <SummaryCard icon={<ShoppingBag className="h-5 w-5" />} label="Total Deals" value={totalDeals} />
        <SummaryCard icon={<Compass className="h-5 w-5" />} label="Your Trips" value={totalTrips} />
        <SummaryCard icon={<Star className="h-5 w-5" />} label="Rivers Tracked" value={trackedCount} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Condition Quality Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Condition Quality Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {totalQuality === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] text-center py-8">
                No condition data available
              </p>
            ) : (
              <div className="flex items-center gap-6">
                {/* Donut chart */}
                <div
                  className="w-32 h-32 rounded-full shrink-0"
                  style={{
                    background: gradientStops.length > 0
                      ? `conic-gradient(${gradientStops.join(", ")})`
                      : "var(--muted)",
                    mask: "radial-gradient(farthest-side, transparent 60%, black 61%)",
                    WebkitMask: "radial-gradient(farthest-side, transparent 60%, black 61%)",
                  }}
                  role="img"
                  aria-label="Condition quality distribution chart"
                />
                {/* Legend */}
                <div className="space-y-1.5">
                  {Object.entries(qualityBreakdown)
                    .filter(([, count]) => count > 0)
                    .map(([quality, count]) => (
                      <div key={quality} className="flex items-center gap-2 text-sm">
                        <div
                          className="w-3 h-3 rounded-sm shrink-0"
                          style={{ backgroundColor: QUALITY_COLORS[quality] }}
                        />
                        <span className="capitalize">{quality}</span>
                        <span className="text-[var(--muted-foreground)]">({count})</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] text-center py-8">
                No recent activity
              </p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {recentActivity.map((alert) => {
                  const iconInfo = activityIcons[alert.type] ?? activityIcons.digest;
                  return (
                    <div key={alert.id} className="flex items-start gap-3">
                      <div className={cn("p-1.5 rounded shrink-0", iconInfo.color)}>
                        {iconInfo.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{alert.title}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          {timeAgo(alert.sentAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )

      {/* Global Safety Dashboard */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-500" aria-hidden="true" />
              Safety Dashboard
            </CardTitle>
            {safetyAlertCount > 0 && (
              <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                {safetyAlertCount} active alert{safetyAlertCount !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {safetyAlertCount === 0 && criticalAlerts.length === 0 ? (
            <div className="text-center py-6">
              <ShieldAlert className="h-8 w-8 mx-auto mb-2 text-green-500 opacity-60" aria-hidden="true" />
              <p className="text-sm text-[var(--muted-foreground)]">
                No active safety alerts across all rivers
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {criticalAlerts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide">
                    Critical Alerts
                  </p>
                  {criticalAlerts.map((alert) => (
                    <Link
                      key={alert.id}
                      href={`/rivers/${alert.river?.id ?? alert.riverId}`}
                      className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                    >
                      <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-red-800 dark:text-red-200 truncate">
                          {alert.title}
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400">
                          {alert.river?.name ?? "Unknown River"}{alert.river?.state ? `, ${alert.river.state}` : ""}
                          {" · "}{timeAgo(alert.createdAt)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              {safetyAlertCount > criticalAlerts.length && (
                <p className="text-xs text-[var(--muted-foreground)] text-center pt-2">
                  + {safetyAlertCount - criticalAlerts.length} other active alert{safetyAlertCount - criticalAlerts.length !== 1 ? "s" : ""} across all rivers
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>}
          </CardContent>
        </Card>
      </div>

      {/* Your Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Your Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MiniStat label="Rivers Tracked" value={trackedCount} />
            <MiniStat label="Trips Planned" value={totalTrips} />
            <MiniStat label="Deal Filters" value={filterCount} />
            <MiniStat label="Total Rivers" value={totalRivers} />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  valueColor?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-[var(--muted-foreground)] mb-2">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className={cn("text-2xl font-bold", valueColor)}>
          {value.toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center p-3 rounded-lg bg-[var(--muted)]/50">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
    </div>
  );
}

export default function StatsPage() {
  return (
    <AuthGuard>
      <StatsContent />
    </AuthGuard>
  );
}
