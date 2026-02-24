"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DealCard } from "@/components/deal-card";
import { CreateFilterDialog } from "@/components/create-filter-dialog";
import { getDeals, getDealFilters } from "@/lib/api";
import {
  ShoppingBag,
  Search,
  SlidersHorizontal,
  Loader2,
  X,
  Filter,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { GearDealRecord, DealFilterRecord } from "@/types";

const CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "raft", label: "Raft" },
  { value: "kayak", label: "Kayak" },
  { value: "paddle", label: "Paddle" },
  { value: "pfd", label: "PFD" },
  { value: "drysuit", label: "Drysuit" },
  { value: "other", label: "Other" },
];

// Temporary user ID for demo — in production this comes from auth
const DEMO_USER_ID = "demo-user";

export default function DealsPage() {
  const [deals, setDeals] = useState<GearDealRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<DealFilterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [category, setCategory] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [region, setRegion] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showSavedFilters, setShowSavedFilters] = useState(false);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number | undefined> = {};
      if (category) params.category = category;
      if (maxPrice) params.maxPrice = Number(maxPrice);
      if (region) params.region = region;
      const data = await getDeals(params);
      setDeals(data.deals);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load deals");
    } finally {
      setLoading(false);
    }
  }, [category, maxPrice, region]);

  const fetchFilters = useCallback(async () => {
    try {
      const data = await getDealFilters(DEMO_USER_ID);
      setFilters(data);
    } catch {
      // Filters are optional; silently fail
    }
  }, []);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  const clearFilters = () => {
    setCategory("");
    setMaxPrice("");
    setRegion("");
  };

  const hasActiveFilters = !!(category || maxPrice || region);

  return (
    <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-7 w-7 text-[var(--primary)]" />
            Raft Watch
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Craigslist gear deals matching your interests
          </p>
        </div>
        <CreateFilterDialog
          userId={DEMO_USER_ID}
          onFilterCreated={fetchFilters}
        />
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <Badge className="ml-1.5" variant="default">
                {[category, maxPrice, region].filter(Boolean).length}
              </Badge>
            )}
            {showFilters ? (
              <ChevronUp className="h-3 w-3 ml-1" />
            ) : (
              <ChevronDown className="h-3 w-3 ml-1" />
            )}
          </Button>

          {filters.length > 0 && (
            <Button
              variant={showSavedFilters ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowSavedFilters(!showSavedFilters)}
            >
              <Filter className="h-4 w-4" />
              Saved Alerts ({filters.length})
            </Button>
          )}

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>

        {/* Filter panel */}
        {showFilters && (
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category || "all"} onValueChange={(v) => setCategory(v === "all" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value || "all"} value={cat.value || "all"}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Max Price ($)</Label>
                  <Input
                    type="number"
                    placeholder="No limit"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    min="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Region</Label>
                  <Input
                    placeholder="e.g., denver"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Saved filters */}
        {showSavedFilters && filters.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Saved Deal Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {filters.map((filter) => (
                <div
                  key={filter.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-[var(--muted)]"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{filter.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {filter.matchCount} matches
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {filter.keywords.map((kw) => (
                        <Badge key={kw} variant="outline" className="text-xs">
                          {kw}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={filter.isActive}
                      onCheckedChange={() => {
                        /* TODO: toggle filter via API */
                      }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Results header */}
      {!loading && (
        <p className="text-sm text-[var(--muted-foreground)]">
          {total} deal{total !== 1 ? "s" : ""} found
        </p>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--muted-foreground)]" />
        </div>
      ) : error ? (
        <div className="text-center py-20 space-y-3">
          <p className="text-[var(--destructive)] font-medium">{error}</p>
          <button
            onClick={fetchDeals}
            className="text-sm text-[var(--primary)] hover:underline"
          >
            Try again
          </button>
        </div>
      ) : deals.length === 0 ? (
        <EmptyDeals hasFilters={hasActiveFilters} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}
    </main>
  );
}

function EmptyDeals({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="text-center py-20 space-y-4">
      <div className="flex justify-center">
        <div className="rounded-full bg-[var(--muted)] p-4">
          <ShoppingBag className="h-10 w-10 text-[var(--muted-foreground)]" />
        </div>
      </div>
      {hasFilters ? (
        <>
          <h2 className="text-lg font-semibold">No deals match your filters</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            Try broadening your search or create a deal alert to get notified of
            new matches.
          </p>
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold">No deals yet</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            The scraping pipeline will populate gear deals from Craigslist
            automatically. Create a deal alert to get notified when deals appear.
          </p>
        </>
      )}
    </div>
  );
}
