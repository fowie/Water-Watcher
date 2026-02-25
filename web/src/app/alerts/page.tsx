"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Bell,
  ShoppingBag,
  Droplets,
  AlertTriangle,
  Inbox,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { AuthGuard } from "@/components/auth-guard";
import { getAlerts } from "@/lib/api";
import { timeAgo, cn } from "@/lib/utils";
import type { AlertLogRecord } from "@/lib/api";

const filterTabs = [
  { label: "All", value: undefined },
  { label: "Deals", value: "deal" },
  { label: "Conditions", value: "condition" },
  { label: "Hazards", value: "hazard" },
] as const;

const typeConfig: Record<string, { icon: typeof Bell; color: string; label: string }> = {
  deal: { icon: ShoppingBag, color: "text-blue-600 bg-blue-50", label: "Deal" },
  condition: { icon: Droplets, color: "text-green-600 bg-green-50", label: "Condition" },
  hazard: { icon: AlertTriangle, color: "text-red-600 bg-red-50", label: "Hazard" },
  digest: { icon: Bell, color: "text-purple-600 bg-purple-50", label: "Digest" },
};

export default function AlertsPage() {
  return (
    <AuthGuard>
      <AlertsContent />
    </AuthGuard>
  );
}

function AlertsContent() {
  const [alerts, setAlerts] = useState<AlertLogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | undefined>(undefined);

  const PAGE_SIZE = 20;

  const fetchAlerts = useCallback(async (type?: string) => {
    setLoading(true);
    try {
      const data = await getAlerts({ type, limit: PAGE_SIZE, offset: 0 });
      setAlerts(data.alerts);
      setTotal(data.total);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts(activeFilter);
  }, [activeFilter, fetchAlerts]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const data = await getAlerts({
        type: activeFilter,
        limit: PAGE_SIZE,
        offset: alerts.length,
      });
      setAlerts((prev) => [...prev, ...data.alerts]);
      setTotal(data.total);
    } catch {
      // Silent fail
    } finally {
      setLoadingMore(false);
    }
  };

  const hasMore = alerts.length < total;

  return (
    <main className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Bell className="h-7 w-7 text-[var(--primary)]" aria-hidden="true" />
          Alert History
        </h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Past notifications for deal matches, condition changes, and hazard alerts
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Filter alerts by type">
        {filterTabs.map((tab) => (
          <button
            key={tab.label}
            role="tab"
            aria-selected={activeFilter === tab.value}
            onClick={() => setActiveFilter(tab.value)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors border",
              activeFilter === tab.value
                ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                : "bg-transparent text-[var(--muted-foreground)] border-[var(--border)] hover:bg-[var(--secondary)]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading Skeletons */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No alerts yet"
          description={
            activeFilter
              ? `No ${activeFilter} alerts found. Try a different filter or check back later.`
              : "When you receive notifications for river conditions, hazards, or deal matches, they'll appear here."
          }
        >
          <Link href="/rivers">
            <Button variant="outline" size="sm" className="mt-2">
              Browse Rivers
            </Button>
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Loading…
                  </span>
                ) : (
                  `Load More (${total - alerts.length} remaining)`
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function AlertCard({ alert }: { alert: AlertLogRecord }) {
  const config = typeConfig[alert.type] || typeConfig.digest;
  const Icon = config.icon;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "rounded-full p-2 shrink-0",
              config.color
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium truncate">{alert.title}</h3>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {config.label}
              </Badge>
            </div>
            {alert.body && (
              <p className="text-sm text-[var(--muted-foreground)] mt-1">
                {alert.body}
              </p>
            )}
            <p className="text-xs text-[var(--muted-foreground)] mt-2">
              {timeAgo(alert.sentAt)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
