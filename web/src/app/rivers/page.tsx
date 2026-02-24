"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { RiverCard } from "@/components/river-card";
import { AddRiverDialog } from "@/components/add-river-dialog";
import { getRivers } from "@/lib/api";
import { Search, Mountain, Loader2 } from "lucide-react";
import type { RiverSummary } from "@/types";

export default function RiversPage() {
  const [rivers, setRivers] = useState<RiverSummary[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRivers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRivers({ search: search || undefined });
      setRivers(data);
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
        <AddRiverDialog onRiverAdded={fetchRivers} />
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
        <Input
          placeholder="Search rivers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin-slow text-[var(--muted-foreground)]" />
        </div>
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
      ) : rivers.length === 0 ? (
        <EmptyState hasSearch={!!search} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rivers.map((river) => (
            <RiverCard key={river.id} river={river} />
          ))}
        </div>
      )}
    </main>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="text-center py-20 space-y-4">
      <div className="flex justify-center">
        <div className="rounded-full bg-[var(--muted)] p-4">
          <Mountain className="h-10 w-10 text-[var(--muted-foreground)]" />
        </div>
      </div>
      {hasSearch ? (
        <>
          <h2 className="text-lg font-semibold">No rivers found</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Try adjusting your search terms or add a new river.
          </p>
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold">No rivers tracked yet</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Add your first river to start monitoring conditions, hazards, and
            more.
          </p>
        </>
      )}
    </div>
  );
}
