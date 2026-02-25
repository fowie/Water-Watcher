"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RiverCard } from "@/components/river-card";
import { AddRiverDialog } from "@/components/add-river-dialog";
import { EmptyState } from "@/components/empty-state";
import { getRivers, getTrackedRivers, trackRiver, untrackRiver } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Search, Mountain, X, GitCompareArrows } from "lucide-react";
import type { RiverSummary } from "@/types";

const DIFFICULTY_CLASSES = [
  "Class I",
  "Class II",
  "Class III",
  "Class IV",
  "Class V",
  "Class V+",
] as const;

const DIFFICULTY_CHIP_COLORS: Record<string, string> = {
  "Class I": "bg-green-100 text-green-800 border-green-300 hover:bg-green-200",
  "Class II": "bg-green-100 text-green-800 border-green-300 hover:bg-green-200",
  "Class III": "bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200",
  "Class IV": "bg-orange-100 text-orange-800 border-orange-300 hover:bg-orange-200",
  "Class V": "bg-red-100 text-red-800 border-red-300 hover:bg-red-200",
  "Class V+": "bg-red-200 text-red-900 border-red-400 hover:bg-red-300",
};

const DIFFICULTY_CHIP_ACTIVE: Record<string, string> = {
  "Class I": "bg-green-600 text-white border-green-700",
  "Class II": "bg-green-600 text-white border-green-700",
  "Class III": "bg-yellow-500 text-white border-yellow-600",
  "Class IV": "bg-orange-500 text-white border-orange-600",
  "Class V": "bg-red-600 text-white border-red-700",
  "Class V+": "bg-red-700 text-white border-red-800",
};

type SortOption = "name-asc" | "recently-updated" | "most-hazards";

export default function RiversPage() {
  const router = useRouter();
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  const [rivers, setRivers] = useState<RiverSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDifficulties, setSelectedDifficulties] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");

  // Compare mode
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());

  // Tracked/favorited river IDs
  const [trackedIds, setTrackedIds] = useState<Set<string>>(new Set());

  const fetchRivers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRivers({ search: search || undefined });
      setRivers(data.rivers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rivers");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timeout = setTimeout(fetchRivers, search ? 300 : 0);
    return () => clearTimeout(timeout);
  }, [fetchRivers, search]);

  // Fetch tracked river IDs for authenticated users
  useEffect(() => {
    if (!isAuthenticated) return;
    getTrackedRivers()
      .then((data) => {
        setTrackedIds(new Set(data.rivers.map((r) => r.id)));
      })
      .catch(() => {
        // Silent — tracks are a nice-to-have overlay
      });
  }, [isAuthenticated]);

  const toggleCompareSelect = (riverId: string) => {
    setSelectedForCompare((prev) => {
      const next = new Set(prev);
      if (next.has(riverId)) {
        next.delete(riverId);
      } else {
        if (next.size >= 3) {
          toast({
            title: "Max 3 rivers",
            description: "You can compare up to 3 rivers at a time.",
            variant: "destructive",
          });
          return prev;
        }
        next.add(riverId);
      }
      return next;
    });
  };

  const goToCompare = () => {
    if (selectedForCompare.size < 2) {
      toast({
        title: "Select at least 2 rivers",
        description: "Pick 2-3 rivers to compare.",
        variant: "destructive",
      });
      return;
    }
    const ids = Array.from(selectedForCompare).join(",");
    router.push(`/rivers/compare?rivers=${ids}`);
  };

  const exitCompareMode = () => {
    setCompareMode(false);
    setSelectedForCompare(new Set());
  };

  const handleToggleFavorite = async (river: RiverSummary) => {
    const isTracked = trackedIds.has(river.id);
    try {
      if (isTracked) {
        await untrackRiver(river.id);
        setTrackedIds((prev) => {
          const next = new Set(prev);
          next.delete(river.id);
          return next;
        });
        toast({
          title: "River untracked",
          description: `"${river.name}" removed from your tracked rivers.`,
          variant: "success",
        });
      } else {
        await trackRiver(river.id);
        setTrackedIds((prev) => new Set(prev).add(river.id));
        toast({
          title: "River tracked!",
          description: `"${river.name}" added to your tracked rivers.`,
          variant: "success",
        });
      }
    } catch (err) {
      toast({
        title: "Failed",
        description: err instanceof Error ? err.message : "Could not update tracking.",
        variant: "destructive",
      });
    }
  };

  const toggleDifficulty = (diff: string) => {
    setSelectedDifficulties((prev) => {
      const next = new Set(prev);
      if (next.has(diff)) {
        next.delete(diff);
      } else {
        next.add(diff);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setSelectedDifficulties(new Set());
    setSortBy("name-asc");
  };

  const hasFilters = selectedDifficulties.size > 0 || sortBy !== "name-asc";

  // Client-side filtering and sorting on already-fetched data
  const filteredAndSorted = useMemo(() => {
    let result = [...rivers];

    // Filter by difficulty
    if (selectedDifficulties.size > 0) {
      result = result.filter((r) => {
        if (!r.difficulty) return false;
        return Array.from(selectedDifficulties).some((d) =>
          r.difficulty?.includes(d)
        );
      });
    }

    // Sort
    switch (sortBy) {
      case "name-asc":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "recently-updated":
        result.sort((a, b) => {
          const aDate = a.latestCondition?.scrapedAt ?? "";
          const bDate = b.latestCondition?.scrapedAt ?? "";
          return bDate.localeCompare(aDate);
        });
        break;
      case "most-hazards":
        result.sort((a, b) => b.activeHazardCount - a.activeHazardCount);
        break;
    }

    return result;
  }, [rivers, selectedDifficulties, sortBy]);

  return (
    <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Mountain className="h-7 w-7 text-[var(--primary)]" />
            Rivers
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Track conditions across your favorite rivers
          </p>
        </div>
        <div className="flex items-center gap-2">
          {compareMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={exitCompareMode}
              >
                <X className="h-4 w-4 mr-1.5" aria-hidden="true" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={goToCompare}
                disabled={selectedForCompare.size < 2}
              >
                <GitCompareArrows className="h-4 w-4 mr-1.5" aria-hidden="true" />
                Compare ({selectedForCompare.size})
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCompareMode(true)}
                disabled={rivers.length < 2}
              >
                <GitCompareArrows className="h-4 w-4 mr-1.5" aria-hidden="true" />
                Compare
              </Button>
              <AddRiverDialog onRiverAdded={fetchRivers} />
            </>
          )}
        </div>
      </div>

      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
          <Input
            placeholder="Search rivers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Name A–Z</SelectItem>
              <SelectItem value="recently-updated">Recently Updated</SelectItem>
              <SelectItem value="most-hazards">Most Hazards</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Difficulty filter chips */}
      <div className="flex flex-wrap gap-2">
        {DIFFICULTY_CLASSES.map((diff) => {
          const active = selectedDifficulties.has(diff);
          return (
            <button
              key={diff}
              onClick={() => toggleDifficulty(diff)}
              className={`inline-flex items-center rounded-md border px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                active
                  ? DIFFICULTY_CHIP_ACTIVE[diff]
                  : DIFFICULTY_CHIP_COLORS[diff]
              }`}
            >
              {diff}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <RiversSkeleton />
      ) : error ? (
        <div className="text-center py-20 space-y-3">
          <p className="text-[var(--destructive)] font-medium">{error}</p>
          <button
            onClick={fetchRivers}
            className="text-sm text-[var(--primary)] hover:underline"
          >
            Try again
          </button>
        </div>
      ) : filteredAndSorted.length === 0 ? (
        <EmptyState
          icon={Mountain}
          title={
            search || selectedDifficulties.size > 0
              ? "No rivers found"
              : "No rivers tracked yet"
          }
          description={
            search || selectedDifficulties.size > 0
              ? "Try adjusting your search or filters, or add a new river."
              : "Add your first river to start monitoring conditions, hazards, and more."
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSorted.map((river) => (
            <RiverCard
              key={river.id}
              river={river}
              onDelete={compareMode ? undefined : fetchRivers}
              isFavorited={trackedIds.has(river.id)}
              onToggleFavorite={isAuthenticated && !compareMode ? () => handleToggleFavorite(river) : undefined}
              selectable={compareMode}
              selected={selectedForCompare.has(river.id)}
              onSelect={compareMode ? toggleCompareSelect : undefined}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function RiversSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-[var(--radius)] border border-[var(--border)] p-4 space-y-3"
        >
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-1/3 mt-2" />
        </div>
      ))}
    </div>
  );
}
