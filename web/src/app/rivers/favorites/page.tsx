"use client";

import { useState, useEffect, useCallback } from "react";
import { RiverCard } from "@/components/river-card";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthGuard } from "@/components/auth-guard";
import { getTrackedRivers, untrackRiver } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Star, Mountain } from "lucide-react";
import type { RiverSummary } from "@/types";

export default function FavoritesPage() {
  return (
    <AuthGuard>
      <FavoritesContent />
    </AuthGuard>
  );
}

function FavoritesContent() {
  const [rivers, setRivers] = useState<RiverSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrackedRivers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTrackedRivers();
      setRivers(data.rivers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tracked rivers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrackedRivers();
  }, [fetchTrackedRivers]);

  const handleUntrack = async (riverId: string, riverName: string) => {
    try {
      await untrackRiver(riverId);
      setRivers((prev) => prev.filter((r) => r.id !== riverId));
      toast({
        title: "River removed",
        description: `"${riverName}" removed from your tracked rivers.`,
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Failed to remove",
        description: err instanceof Error ? err.message : "Could not remove river.",
        variant: "destructive",
      });
    }
  };

  return (
    <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Star className="h-7 w-7 text-yellow-500" aria-hidden="true" />
          My Rivers
        </h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Rivers you&apos;re tracking for conditions and alerts
        </p>
      </div>

      {/* Content */}
      {loading ? (
        <FavoritesSkeleton />
      ) : error ? (
        <div className="text-center py-20 space-y-3">
          <p className="text-[var(--destructive)] font-medium">{error}</p>
          <button
            onClick={fetchTrackedRivers}
            className="text-sm text-[var(--primary)] hover:underline"
          >
            Try again
          </button>
        </div>
      ) : rivers.length === 0 ? (
        <EmptyState
          icon={Mountain}
          title="No tracked rivers yet"
          description="Star rivers from the rivers page to add them to your tracking list. You'll see them here for quick access."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rivers.map((river) => (
            <RiverCard
              key={river.id}
              river={river}
              isFavorited
              onToggleFavorite={() => handleUntrack(river.id, river.name)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function FavoritesSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
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
