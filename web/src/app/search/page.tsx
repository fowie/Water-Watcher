"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { search, type SearchResultItem } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Search,
  Mountain,
  ShoppingBag,
  Compass,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

const TYPE_ICONS: Record<string, typeof Mountain> = {
  river: Mountain,
  deal: ShoppingBag,
  trip: Compass,
  review: MessageSquare,
};

const FILTER_TABS = [
  { value: "all", label: "All" },
  { value: "rivers", label: "Rivers" },
  { value: "deals", label: "Deals" },
  { value: "trips", label: "Trips" },
  { value: "reviews", label: "Reviews" },
] as const;

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams.get("q") ?? "";
  const initialType = (searchParams.get("type") ?? "all") as string;

  const [query, setQuery] = useState(initialQ);
  const [activeType, setActiveType] = useState(initialType);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async (q: string, type: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const typeParam = type === "all" ? undefined : (type as "rivers" | "deals" | "trips" | "reviews");
      const data = await search({ q, type: typeParam, limit: 50 });
      const all = [
        ...data.rivers,
        ...data.deals,
        ...data.trips,
        ...data.reviews,
      ];
      setResults(all);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Search on initial load if q is in URL
  useEffect(() => {
    if (initialQ) {
      doSearch(initialQ, initialType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (activeType !== "all") params.set("type", activeType);
      router.push(`/search?${params.toString()}`);
      doSearch(query, activeType);
    },
    [query, activeType, router, doSearch]
  );

  const handleTypeChange = useCallback(
    (type: string) => {
      setActiveType(type);
      if (query.trim()) {
        const params = new URLSearchParams();
        params.set("q", query.trim());
        if (type !== "all") params.set("type", type);
        router.push(`/search?${params.toString()}`);
        doSearch(query, type);
      }
    },
    [query, router, doSearch]
  );

  // Filter results by type for display
  const filtered = activeType === "all"
    ? results
    : results.filter((r) => r.type === activeType.replace(/s$/, ""));

  return (
    <main className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold">Search</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Find rivers, deals, trips, and reviews
        </p>
      </div>

      {/* Search form */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" aria-hidden="true" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="pl-10"
            aria-label="Search query"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      {/* Type filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleTypeChange(tab.value)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              activeType === tab.value
                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                : "bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--secondary)]/80"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {!loading && searched && filtered.length === 0 && (
        <EmptyState
          icon={Search}
          title="No results found"
          description={`We couldn't find anything matching "${query}". Try different keywords or broaden your search.`}
        />
      )}

      {!loading && !searched && (
        <EmptyState
          icon={Search}
          title="Start searching"
          description="Type a query above to find rivers, deals, trips, and reviews."
        />
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((item) => {
            const Icon = TYPE_ICONS[item.type] ?? Search;
            return (
              <Link key={`${item.type}-${item.id}`} href={item.url}>
                <Card className="hover:border-[var(--primary)] transition-colors cursor-pointer h-full">
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="rounded-lg bg-[var(--muted)] p-2 mt-0.5 shrink-0">
                      <Icon className="h-4 w-4 text-[var(--muted-foreground)]" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="font-medium truncate">{item.title}</p>
                      <p className="text-sm text-[var(--muted-foreground)] line-clamp-2">
                        {item.subtitle}
                      </p>
                      <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)] capitalize">
                        {item.type}
                      </span>
                    </div>
                    <ExternalLink className="h-4 w-4 text-[var(--muted-foreground)] shrink-0 mt-1" aria-hidden="true" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {!loading && searched && filtered.length > 0 && (
        <p className="text-sm text-[var(--muted-foreground)] text-center">
          Showing {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </p>
      )}
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <main className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </main>
    }>
      <SearchPageContent />
    </Suspense>
  );
}
