"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConditionBadge } from "@/components/condition-badge";
import { EmptyState } from "@/components/empty-state";
import { getRiver } from "@/lib/api";
import { formatFlowRate } from "@/lib/utils";
import {
  GitCompareArrows,
  Droplets,
  Thermometer,
  Ruler,
  Mountain,
  AlertTriangle,
  ArrowLeft,
  Trophy,
} from "lucide-react";
import type { RiverDetail } from "@/types";

export default function ComparePage() {
  const searchParams = useSearchParams();
  const riverIds = useMemo(() => {
    const param = searchParams.get("rivers");
    if (!param) return [];
    return param.split(",").filter(Boolean).slice(0, 3);
  }, [searchParams]);

  const [rivers, setRivers] = useState<RiverDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRivers = useCallback(async () => {
    if (riverIds.length === 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled(
        riverIds.map((id) => getRiver(id))
      );
      const loaded: RiverDetail[] = [];
      for (const r of results) {
        if (r.status === "fulfilled") loaded.push(r.value);
      }
      if (loaded.length === 0) {
        setError("Could not load any of the selected rivers.");
      }
      setRivers(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rivers");
    } finally {
      setLoading(false);
    }
  }, [riverIds]);

  useEffect(() => {
    fetchRivers();
  }, [fetchRivers]);

  if (loading) {
    return (
      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-96 w-full" />
          ))}
        </div>
      </main>
    );
  }

  if (riverIds.length === 0) {
    return (
      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <GitCompareArrows className="h-7 w-7 text-[var(--primary)]" aria-hidden="true" />
            Compare Rivers
          </h1>
        </div>
        <EmptyState
          icon={Mountain}
          title="No rivers selected"
          description="Go to the Rivers page, select 2-3 rivers, and click Compare to see them side by side."
        >
          <Button asChild variant="outline" className="mt-4">
            <Link href="/rivers">
              <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
              Back to Rivers
            </Link>
          </Button>
        </EmptyState>
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        <div className="text-center py-20 space-y-3">
          <p className="text-[var(--destructive)] font-medium">{error}</p>
          <button
            onClick={fetchRivers}
            className="text-sm text-[var(--primary)] hover:underline"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  // Determine "best" for each metric
  const latestConditions = rivers.map((r) => r.conditions[0] ?? null);
  const bestFlowIdx = getBestIndex(latestConditions.map((c) => c?.flowRate ?? null));
  const bestTempIdx = getBestIndex(latestConditions.map((c) => c?.waterTemp ?? null));
  const bestGaugeIdx = getBestIndex(latestConditions.map((c) => c?.gaugeHeight ?? null));
  const fewestHazardsIdx = getMinIndex(rivers.map((r) => r.hazards.filter((h) => h.isActive).length));

  return (
    <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <GitCompareArrows className="h-7 w-7 text-[var(--primary)]" aria-hidden="true" />
            Compare Rivers
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Comparing {rivers.length} river{rivers.length !== 1 ? "s" : ""} side by side
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/rivers">
            <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
            Back to Rivers
          </Link>
        </Button>
      </div>

      {/* Desktop: Comparison table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left py-3 px-4 text-sm font-medium text-[var(--muted-foreground)] w-40">
                Metric
              </th>
              {rivers.map((river) => (
                <th key={river.id} className="text-left py-3 px-4">
                  <Link
                    href={`/rivers/${river.id}`}
                    className="text-lg font-semibold hover:text-[var(--primary)] transition-colors"
                  >
                    {river.name}
                  </Link>
                  <p className="text-xs text-[var(--muted-foreground)] font-normal">
                    {river.state}
                    {river.difficulty && ` · ${river.difficulty}`}
                  </p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Quality */}
            <CompareRow label="Quality" icon={<Trophy className="h-4 w-4" />}>
              {latestConditions.map((c, i) => (
                <td key={rivers[i].id} className="py-3 px-4">
                  {c?.quality ? <ConditionBadge quality={c.quality} /> : <span className="text-[var(--muted-foreground)]">—</span>}
                </td>
              ))}
            </CompareRow>

            {/* Flow Rate */}
            <CompareRow label="Flow Rate" icon={<Droplets className="h-4 w-4" />}>
              {latestConditions.map((c, i) => (
                <td key={rivers[i].id} className="py-3 px-4">
                  <CellValue
                    value={c?.flowRate != null ? formatFlowRate(c.flowRate) : null}
                    isBest={i === bestFlowIdx}
                  />
                </td>
              ))}
            </CompareRow>

            {/* Water Temp */}
            <CompareRow label="Water Temp" icon={<Thermometer className="h-4 w-4" />}>
              {latestConditions.map((c, i) => (
                <td key={rivers[i].id} className="py-3 px-4">
                  <CellValue
                    value={c?.waterTemp != null ? `${c.waterTemp}°F` : null}
                    isBest={i === bestTempIdx}
                  />
                </td>
              ))}
            </CompareRow>

            {/* Gauge Height */}
            <CompareRow label="Gauge Height" icon={<Ruler className="h-4 w-4" />}>
              {latestConditions.map((c, i) => (
                <td key={rivers[i].id} className="py-3 px-4">
                  <CellValue
                    value={c?.gaugeHeight != null ? `${c.gaugeHeight} ft` : null}
                    isBest={i === bestGaugeIdx}
                  />
                </td>
              ))}
            </CompareRow>

            {/* Difficulty */}
            <CompareRow label="Difficulty" icon={<Mountain className="h-4 w-4" />}>
              {rivers.map((r) => (
                <td key={r.id} className="py-3 px-4">
                  {r.difficulty ? (
                    <Badge variant="secondary">{r.difficulty}</Badge>
                  ) : (
                    <span className="text-[var(--muted-foreground)]">—</span>
                  )}
                </td>
              ))}
            </CompareRow>

            {/* Active Hazards */}
            <CompareRow label="Active Hazards" icon={<AlertTriangle className="h-4 w-4" />}>
              {rivers.map((r, i) => {
                const count = r.hazards.filter((h) => h.isActive).length;
                return (
                  <td key={r.id} className="py-3 px-4">
                    <span
                      className={`font-medium ${
                        i === fewestHazardsIdx && count === 0
                          ? "text-green-600"
                          : count > 0
                          ? "text-orange-600"
                          : ""
                      }`}
                    >
                      {count}
                      {i === fewestHazardsIdx && rivers.length > 1 && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          Safest
                        </Badge>
                      )}
                    </span>
                  </td>
                );
              })}
            </CompareRow>

            {/* Runnability */}
            <CompareRow label="Runnability" icon={<Droplets className="h-4 w-4" />}>
              {latestConditions.map((c, i) => (
                <td key={rivers[i].id} className="py-3 px-4">
                  {c?.runnability ? (
                    <Badge variant="secondary" className="capitalize">
                      {c.runnability.replace("_", " ")}
                    </Badge>
                  ) : (
                    <span className="text-[var(--muted-foreground)]">—</span>
                  )}
                </td>
              ))}
            </CompareRow>
          </tbody>
        </table>
      </div>

      {/* Mobile: Stacked cards */}
      <div className="md:hidden space-y-4">
        {rivers.map((river, idx) => {
          const cond = river.conditions[0] ?? null;
          const hazardCount = river.hazards.filter((h) => h.isActive).length;
          return (
            <Card key={river.id}>
              <CardHeader className="pb-3">
                <Link href={`/rivers/${river.id}`}>
                  <CardTitle className="text-lg hover:text-[var(--primary)] transition-colors">
                    {river.name}
                  </CardTitle>
                </Link>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {river.state}
                  {river.difficulty && ` · ${river.difficulty}`}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {cond?.quality && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--muted-foreground)]">Quality</span>
                    <ConditionBadge quality={cond.quality} />
                  </div>
                )}
                {cond?.flowRate != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--muted-foreground)] flex items-center gap-1.5">
                      <Droplets className="h-3.5 w-3.5" aria-hidden="true" />
                      Flow Rate
                    </span>
                    <CellValue value={formatFlowRate(cond.flowRate)} isBest={idx === bestFlowIdx} />
                  </div>
                )}
                {cond?.waterTemp != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--muted-foreground)] flex items-center gap-1.5">
                      <Thermometer className="h-3.5 w-3.5" aria-hidden="true" />
                      Water Temp
                    </span>
                    <CellValue value={`${cond.waterTemp}°F`} isBest={idx === bestTempIdx} />
                  </div>
                )}
                {cond?.gaugeHeight != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--muted-foreground)] flex items-center gap-1.5">
                      <Ruler className="h-3.5 w-3.5" aria-hidden="true" />
                      Gauge Height
                    </span>
                    <CellValue value={`${cond.gaugeHeight} ft`} isBest={idx === bestGaugeIdx} />
                  </div>
                )}
                {cond?.runnability && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--muted-foreground)]">Runnability</span>
                    <Badge variant="secondary" className="capitalize">
                      {cond.runnability.replace("_", " ")}
                    </Badge>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--muted-foreground)] flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    Hazards
                  </span>
                  <span className={`text-sm font-medium ${hazardCount > 0 ? "text-orange-600" : "text-green-600"}`}>
                    {hazardCount}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
}

/* ─── Helper components ──────────────────────────────── */

function CompareRow({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <tr className="border-b border-[var(--border)] hover:bg-[var(--secondary)]/50 transition-colors">
      <td className="py-3 px-4 text-sm font-medium text-[var(--muted-foreground)]">
        <span className="flex items-center gap-2">
          {icon}
          {label}
        </span>
      </td>
      {children}
    </tr>
  );
}

function CellValue({
  value,
  isBest,
}: {
  value: string | null;
  isBest: boolean;
}) {
  if (value == null) {
    return <span className="text-[var(--muted-foreground)]">—</span>;
  }
  return (
    <span className={`text-sm font-medium ${isBest ? "text-green-600" : ""}`}>
      {value}
      {isBest && (
        <Badge variant="secondary" className="ml-2 text-[10px]">
          Best
        </Badge>
      )}
    </span>
  );
}

/* ─── Utility functions ──────────────────────────────── */

/** Index of the max non-null value (higher = better for flow/temp/gauge). */
function getBestIndex(values: (number | null)[]): number {
  let best = -1;
  let bestVal = -Infinity;
  for (let i = 0; i < values.length; i++) {
    if (values[i] != null && values[i]! > bestVal) {
      bestVal = values[i]!;
      best = i;
    }
  }
  return best;
}

/** Index of the min non-negative value (lower = better for hazards). */
function getMinIndex(values: number[]): number {
  let best = -1;
  let bestVal = Infinity;
  for (let i = 0; i < values.length; i++) {
    if (values[i] < bestVal) {
      bestVal = values[i];
      best = i;
    }
  }
  return best;
}
