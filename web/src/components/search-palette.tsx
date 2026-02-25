"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { search, type SearchResultItem } from "@/lib/api";
import {
  Mountain,
  ShoppingBag,
  Compass,
  MessageSquare,
  Search,
  X,
  Clock,
  ArrowRight,
  CornerDownLeft,
} from "lucide-react";

const TYPE_ICONS: Record<string, typeof Mountain> = {
  river: Mountain,
  deal: ShoppingBag,
  trip: Compass,
  review: MessageSquare,
};

const TYPE_LABELS: Record<string, string> = {
  river: "Rivers",
  deal: "Deals",
  trip: "Trips",
  review: "Reviews",
};

interface SearchPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RECENT_SEARCHES_KEY = "water-watcher-recent-searches";

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  if (typeof window === "undefined") return;
  try {
    const recent = getRecentSearches().filter((s) => s !== query);
    recent.unshift(query);
    localStorage.setItem(
      RECENT_SEARCHES_KEY,
      JSON.stringify(recent.slice(0, 5))
    );
  } catch {
    // ignored
  }
}

export function SearchPalette({ open, onOpenChange }: SearchPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches());
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // Focus trap: keep focus within palette while open
  useEffect(() => {
    if (!open) return;
    function handleFocusTrap(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const container = paletteRef.current;
      if (!container) return;
      const focusable = container.querySelectorAll<HTMLElement>(
        'input, button, [tabindex]:not([tabindex="-1"]), a[href]'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", handleFocusTrap);
    return () => document.removeEventListener("keydown", handleFocusTrap);
  }, [open]);

  // Global keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await search({ q, limit: 8 });
      const all = [
        ...data.rivers,
        ...data.deals,
        ...data.trips,
        ...data.reviews,
      ];
      setResults(all);
      setSelectedIndex(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(value), 300);
    },
    [doSearch]
  );

  const handleSelect = useCallback(
    (result: SearchResultItem) => {
      saveRecentSearch(result.title);
      onOpenChange(false);
      router.push(result.url);
    },
    [router, onOpenChange]
  );

  const handleRecentClick = useCallback(
    (term: string) => {
      setQuery(term);
      doSearch(term);
    },
    [doSearch]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        } else if (query.trim()) {
          saveRecentSearch(query.trim());
          onOpenChange(false);
          router.push(`/search?q=${encodeURIComponent(query.trim())}`);
        }
      }
    },
    [results, selectedIndex, handleSelect, query, onOpenChange, router]
  );

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResultItem[]>>(
    (acc, item) => {
      if (!acc[item.type]) acc[item.type] = [];
      acc[item.type].push(item);
      return acc;
    },
    {}
  );

  // Flat list for index tracking
  const flatResults = Object.values(grouped).flat();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Search">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Palette */}
      <div ref={paletteRef} className="relative mx-auto mt-[15vh] w-full max-w-xl px-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center border-b border-[var(--border)] px-4">
            <Search className="h-5 w-5 text-[var(--muted-foreground)] shrink-0" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search rivers, deals, trips, and reviews..."
              className="flex-1 bg-transparent py-4 px-3 text-sm outline-none placeholder:text-[var(--muted-foreground)]"
              aria-label="Search"
            />
            {query && (
              <button
                onClick={() => handleInputChange("")}
                className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] p-1"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex ml-2 h-5 items-center gap-1 rounded border border-[var(--border)] bg-[var(--muted)] px-1.5 text-[10px] font-medium text-[var(--muted-foreground)]">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[50vh] overflow-y-auto p-2">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!loading && !query.trim() && recentSearches.length > 0 && (
              <div className="py-2">
                <p className="px-3 pb-2 text-xs font-medium text-[var(--muted-foreground)]">
                  Recent searches
                </p>
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    onClick={() => handleRecentClick(term)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-[var(--secondary)] transition-colors"
                  >
                    <Clock className="h-4 w-4 text-[var(--muted-foreground)]" aria-hidden="true" />
                    <span>{term}</span>
                  </button>
                ))}
              </div>
            )}

            {!loading && !query.trim() && recentSearches.length === 0 && (
              <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
                Type to search rivers, deals, trips, and reviews...
              </p>
            )}

            {!loading && query.trim() && results.length === 0 && (
              <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
                No results found for &ldquo;{query}&rdquo;
              </p>
            )}

            {!loading &&
              Object.entries(grouped).map(([type, items]) => {
                const GroupIcon = TYPE_ICONS[type] ?? Search;
                return (
                  <div key={type} className="py-1">
                    <p className="px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wider">
                      {TYPE_LABELS[type] ?? type}
                    </p>
                    {items.map((item) => {
                      const globalIdx = flatResults.indexOf(item);
                      const isSelected = globalIdx === selectedIndex;
                      return (
                        <button
                          key={`${item.type}-${item.id}`}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIndex(globalIdx)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                            isSelected
                              ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                              : "hover:bg-[var(--secondary)]"
                          )}
                        >
                          <GroupIcon
                            className={cn(
                              "h-4 w-4 shrink-0",
                              isSelected
                                ? "text-[var(--primary-foreground)]"
                                : "text-[var(--muted-foreground)]"
                            )}
                            aria-hidden="true"
                          />
                          <div className="flex-1 text-left">
                            <span className="font-medium">{item.title}</span>
                            {item.subtitle && (
                              <span
                                className={cn(
                                  "ml-2 text-xs",
                                  isSelected
                                    ? "text-[var(--primary-foreground)]/70"
                                    : "text-[var(--muted-foreground)]"
                                )}
                              >
                                {item.subtitle}
                              </span>
                            )}
                          </div>
                          {isSelected && (
                            <CornerDownLeft
                              className="h-3.5 w-3.5 shrink-0"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
          </div>

          {/* Footer */}
          {query.trim() && results.length > 0 && (
            <div className="border-t border-[var(--border)] px-4 py-2 flex items-center justify-between">
              <span className="text-xs text-[var(--muted-foreground)]">
                {results.length} result{results.length !== 1 ? "s" : ""}
              </span>
              <button
                onClick={() => {
                  saveRecentSearch(query.trim());
                  onOpenChange(false);
                  router.push(
                    `/search?q=${encodeURIComponent(query.trim())}`
                  );
                }}
                className="flex items-center gap-1 text-xs text-[var(--primary)] hover:underline"
              >
                View all results <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
