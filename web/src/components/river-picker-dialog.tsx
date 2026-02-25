"use client";

import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { RapidRating } from "@/components/rapid-rating";
import { getRivers } from "@/lib/api";
import { Search, Loader2, Mountain } from "lucide-react";
import type { RiverSummary } from "@/types";

interface RiverPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (river: RiverSummary) => void;
}

export function RiverPickerDialog({ open, onOpenChange, onSelect }: RiverPickerDialogProps) {
  const [search, setSearch] = useState("");
  const [rivers, setRivers] = useState<RiverSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRivers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRivers({ search: search || undefined, limit: 50 });
      setRivers(data.rivers);
    } catch {
      setRivers([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      loadRivers();
    }, 300);
    return () => clearTimeout(timer);
  }, [open, loadRivers]);

  const handleSelect = (river: RiverSummary) => {
    onSelect(river);
    onOpenChange(false);
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select a River</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" aria-hidden="true" />
          <Input
            placeholder="Search rivers by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 space-y-1 mt-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
            </div>
          ) : rivers.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Mountain className="h-8 w-8 mx-auto text-[var(--muted-foreground)]" />
              <p className="text-sm text-[var(--muted-foreground)]">No rivers found</p>
            </div>
          ) : (
            rivers.map((river) => (
              <button
                key={river.id}
                onClick={() => handleSelect(river)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-[var(--secondary)] transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{river.name}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">{river.state}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {river.difficulty && <RapidRating difficulty={river.difficulty} />}
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
