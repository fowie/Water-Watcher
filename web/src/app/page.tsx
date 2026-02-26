"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getRivers, getDeals, getDealFilters } from "@/lib/api";
import { RiverCard } from "@/components/river-card";
import { DealCard } from "@/components/deal-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Waves,
  Mountain,
  AlertTriangle,
  ShoppingBag,
  Filter,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import type { RiverSummary, GearDealRecord } from "@/types";

const DEMO_USER_ID = "demo-user";

interface DashboardStats {
  totalRivers: number;
  activeHazards: number;
  recentDeals: number;
  activeFilters: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentRivers, setRecentRivers] = useState<RiverSummary[]>([]);
  const [latestDeals, setLatestDeals] = useState<GearDealRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [riversRes, dealsRes, filtersRes] = await Promise.allSettled([
          getRivers({ limit: 5 }),
          getDeals({ limit: 3 }),
          getDealFilters(DEMO_USER_ID),
        ]);

        const rivers =
          riversRes.status === "fulfilled"
            ? riversRes.value
            : { rivers: [], total: 0 };
        const deals =
          dealsRes.status === "fulfilled"
            ? dealsRes.value
            : { deals: [], total: 0 };
        const filters =
          filtersRes.status === "fulfilled" ? filtersRes.value : [];

        const hazardCount = rivers.rivers.reduce(
          (sum: number, r: RiverSummary) => sum + r.activeHazardCount,
          0
        );

        setRecentRivers(rivers.rivers);
        setLatestDeals(deals.deals);
        setStats({
          totalRivers: rivers.total,
          activeHazards: hazardCount,
          recentDeals: deals.total,
          activeFilters: filters.filter((f) => f.isActive).length,
        });
      } catch {
        // Silent fail — dashboard shows what it can
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  return (
    <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Onboarding wizard for first-time users */}
      <OnboardingWizard />

      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Waves className="h-7 w-7 text-[var(--primary)]" />
          Water-Watcher
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Your whitewater dashboard — conditions, hazards, and gear deals at a
          glance.
        </p>
      </div>

      {/* Stats Row */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[var(--radius)] border border-[var(--border)] p-4 space-y-2"
            >
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-12" />
            </div>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Mountain className="h-5 w-5" />}
            label="Rivers Tracked"
            value={stats.totalRivers}
          />
          <StatCard
            icon={<AlertTriangle className="h-5 w-5" />}
            label="Active Hazards"
            value={stats.activeHazards}
            accent={stats.activeHazards > 0 ? "text-orange-600" : undefined}
          />
          <StatCard
            icon={<ShoppingBag className="h-5 w-5" />}
            label="Gear Deals"
            value={stats.recentDeals}
          />
          <StatCard
            icon={<Filter className="h-5 w-5" />}
            label="Active Filters"
            value={stats.activeFilters}
          />
        </div>
      ) : null}

      {/* Recent Conditions */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[var(--primary)]" />
            Recent Conditions
          </h2>
          <Link
            href="/rivers"
            className="text-sm text-[var(--primary)] hover:underline flex items-center gap-1"
          >
            View all <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-[var(--radius)] border border-[var(--border)] p-4 space-y-3"
              >
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : recentRivers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentRivers.slice(0, 5).map((river) => (
              <RiverCard key={river.id} river={river} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)] py-4">
            No rivers tracked yet.{" "}
            <Link
              href="/rivers"
              className="text-[var(--primary)] hover:underline"
            >
              Add your first river
            </Link>
          </p>
        )}
      </section>

      {/* Latest Deals */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-[var(--primary)]" />
            Latest Deals
          </h2>
          <Link
            href="/deals"
            className="text-sm text-[var(--primary)] hover:underline flex items-center gap-1"
          >
            Browse all <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-[var(--radius)] border border-[var(--border)] p-4 space-y-3"
              >
                <Skeleton className="h-32 w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : latestDeals.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {latestDeals.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)] py-4">
            No deals found yet.{" "}
            <Link
              href="/deals"
              className="text-[var(--primary)] hover:underline"
            >
              Check deal filters
            </Link>
          </p>
        )}
      </section>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--background)] p-4 space-y-1">
      <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${accent ?? ""}`}>{value}</p>
    </div>
  );
}
