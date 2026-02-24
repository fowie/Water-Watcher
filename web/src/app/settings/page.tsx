"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { getDealFilters, updateDealFilter } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import {
  Settings,
  Bell,
  Database,
  Info,
  Trash2,
  RefreshCw,
  ExternalLink,
  Filter,
} from "lucide-react";
import type { DealFilterRecord } from "@/types";

const DEMO_USER_ID = "demo-user";

export default function SettingsPage() {
  return (
    <main className="p-4 md:p-8 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Settings className="h-7 w-7 text-[var(--primary)]" aria-hidden="true" />
          Settings
        </h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Manage notifications, data, and app preferences
        </p>
      </div>

      <NotificationPreferences />
      <Separator />
      <DataManagement />
      <Separator />
      <AboutSection />
    </main>
  );
}

/* ─── Notification Preferences ───────────────────────── */

function NotificationPreferences() {
  const [filters, setFilters] = useState<DealFilterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchFilters = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDealFilters(DEMO_USER_ID);
      setFilters(data);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  const handleToggle = async (filter: DealFilterRecord, checked: boolean) => {
    setTogglingId(filter.id);
    try {
      await updateDealFilter(filter.id, DEMO_USER_ID, { isActive: checked });
      setFilters((prev) =>
        prev.map((f) => (f.id === filter.id ? { ...f, isActive: checked } : f))
      );
      toast({
        title: checked ? "Filter enabled" : "Filter disabled",
        description: `"${filter.name}" is now ${checked ? "active" : "paused"}.`,
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Failed to update filter",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setTogglingId(null);
    }
  };

  const activeCount = filters.filter((f) => f.isActive).length;

  return (
    <section aria-labelledby="notifications-heading">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-[var(--primary)]" aria-hidden="true" />
          <h2 id="notifications-heading" className="text-lg font-semibold">
            Notification Preferences
          </h2>
        </div>
        {!loading && filters.length > 0 && (
          <Badge variant="secondary">
            {activeCount} of {filters.length} active
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : filters.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-[var(--muted-foreground)]">
            <Filter className="h-8 w-8 mx-auto mb-2 opacity-40" aria-hidden="true" />
            <p>No deal filters set up yet.</p>
            <p className="mt-1">
              Create filters on the{" "}
              <a href="/deals" className="text-[var(--primary)] hover:underline">
                Raft Watch
              </a>{" "}
              page to get notifications.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filters.map((filter) => (
            <Card key={filter.id}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">
                      {filter.name}
                    </span>
                    {filter.keywords.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {filter.keywords.slice(0, 3).map((kw) => (
                          <Badge key={kw} variant="outline" className="text-xs">
                            {kw}
                          </Badge>
                        ))}
                        {filter.keywords.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{filter.keywords.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    {filter.matchCount} match{filter.matchCount !== 1 ? "es" : ""} found
                    {filter.maxPrice != null && ` · Max $${filter.maxPrice}`}
                    {filter.regions.length > 0 && ` · ${filter.regions.join(", ")}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={`filter-toggle-${filter.id}`}
                    className="sr-only"
                  >
                    {filter.isActive ? "Disable" : "Enable"} {filter.name}
                  </Label>
                  <Switch
                    id={`filter-toggle-${filter.id}`}
                    checked={filter.isActive}
                    onCheckedChange={(checked) => handleToggle(filter, checked)}
                    disabled={togglingId === filter.id}
                    aria-label={`${filter.isActive ? "Disable" : "Enable"} ${filter.name} filter`}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

/* ─── Data Management ────────────────────────────────── */

function DataManagement() {
  const [seeding, setSeeding] = useState(false);

  const handleClearCache = () => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key !== "theme") {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
      toast({
        title: "Cache cleared",
        description: `Removed ${keysToRemove.length} cached item${keysToRemove.length !== 1 ? "s" : ""}.`,
        variant: "success",
      });
    } catch {
      toast({
        title: "Failed to clear cache",
        description: "localStorage may not be available.",
        variant: "destructive",
      });
    }
  };

  const handleSeedDatabase = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/health");
      if (!res.ok) throw new Error("API unreachable");
      toast({
        title: "Database ready",
        description: "The database is connected and healthy. Seed data via the Prisma CLI: npx prisma db seed",
      });
    } catch {
      toast({
        title: "Connection check failed",
        description: "Could not reach the API. Make sure the server is running.",
        variant: "destructive",
      });
    } finally {
      setSeeding(false);
    }
  };

  return (
    <section aria-labelledby="data-heading">
      <div className="flex items-center gap-2 mb-4">
        <Database className="h-5 w-5 text-[var(--primary)]" aria-hidden="true" />
        <h2 id="data-heading" className="text-lg font-semibold">
          Data Management
        </h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <h3 className="font-medium text-sm">Seed Database</h3>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                Check database connectivity and seed status.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeedDatabase}
              disabled={seeding}
              aria-label="Check database connection"
            >
              <RefreshCw
                className={`h-4 w-4 ${seeding ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {seeding ? "Checking..." : "Check Connection"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <h3 className="font-medium text-sm">Clear Local Cache</h3>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                Remove cached preferences and notification settings (keeps theme).
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCache}
              aria-label="Clear local storage cache"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Clear Cache
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

/* ─── About ──────────────────────────────────────────── */

function AboutSection() {
  return (
    <section aria-labelledby="about-heading">
      <div className="flex items-center gap-2 mb-4">
        <Info className="h-5 w-5 text-[var(--primary)]" aria-hidden="true" />
        <h2 id="about-heading" className="text-lg font-semibold">
          About
        </h2>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Version</span>
            <Badge variant="secondary">Water-Watcher v0.1.0</Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Source Code</span>
            <a
              href="https://github.com/Water-Watcher/Water-Watcher"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-[var(--primary)] hover:underline"
              aria-label="View source code on GitHub"
            >
              GitHub
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
          <Separator />
          <p className="text-xs text-[var(--muted-foreground)]">
            Water-Watcher is a whitewater rafting tracker that monitors river
            conditions, hazards, and gear deals. Built with Next.js, Prisma,
            and Python scrapers.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
