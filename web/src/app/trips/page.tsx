"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { AuthGuard } from "@/components/auth-guard";
import { TripCard } from "@/components/trip-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  Compass,
  Plus,
  Search,
  Calendar,
  Loader2,
} from "lucide-react";
import { getTrips, createTrip } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { TripRecord } from "@/lib/api";

type FilterTab = "all" | "upcoming" | "past" | "cancelled";

function TripsContent() {
  const { toast } = useToast();
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const loadTrips = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTrips();
      setTrips(data.trips);
    } catch {
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  const filteredTrips = useMemo(() => {
    const now = new Date();
    let filtered = trips;

    // Tab filter
    switch (activeTab) {
      case "upcoming":
        filtered = filtered.filter(
          (t) => t.status !== "cancelled" && new Date(t.endDate) >= now
        );
        break;
      case "past":
        filtered = filtered.filter(
          (t) => t.status === "completed" || (t.status !== "cancelled" && new Date(t.endDate) < now)
        );
        break;
      case "cancelled":
        filtered = filtered.filter((t) => t.status === "cancelled");
        break;
    }

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((t) => t.name.toLowerCase().includes(q));
    }

    return filtered;
  }, [trips, activeTab, search]);

  const handleCreated = () => {
    setCreateOpen(false);
    loadTrips();
  };

  const tabs: { value: FilterTab; label: string }[] = [
    { value: "all", label: "All" },
    { value: "upcoming", label: "Upcoming" },
    { value: "past", label: "Past" },
    { value: "cancelled", label: "Cancelled" },
  ];

  return (
    <main className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Trip Planner</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Plan and organize your river adventures
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
          New Trip
        </Button>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-1 bg-[var(--muted)] rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                activeTab === tab.value
                  ? "bg-[var(--background)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" aria-hidden="true" />
          <Input
            placeholder="Search trips..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Trip list */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : filteredTrips.length === 0 ? (
        <EmptyState
          icon={Compass}
          title={search ? "No trips match your search" : activeTab === "all" ? "No trips yet" : `No ${activeTab} trips`}
          description={
            search
              ? "Try a different search term."
              : "Create your first river trip to get started!"
          }
        >
          {!search && activeTab === "all" && (
            <Button onClick={() => setCreateOpen(true)} className="mt-4">
              <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
              Plan Your First Trip
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredTrips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}

      {/* Create trip dialog */}
      <CreateTripDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
    </main>
  );
}

// ─── Create Trip Dialog ─────────────────────────────────

interface CreateTripDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function CreateTripDialog({ open, onOpenChange, onCreated }: CreateTripDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate) return;

    setSubmitting(true);
    try {
      await createTrip({
        name: name.trim(),
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        status: "planning",
        notes: notes.trim() || undefined,
        isPublic,
      });
      toast({ title: "Trip created!", description: "Start planning your adventure." });
      setName("");
      setStartDate("");
      setEndDate("");
      setNotes("");
      setIsPublic(false);
      onCreated();
    } catch (err) {
      toast({
        title: "Failed to create trip",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Trip</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="trip-name">Trip Name *</Label>
            <Input
              id="trip-name"
              placeholder="e.g., Summer Grand Canyon Run"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="trip-start">Start Date *</Label>
              <Input
                id="trip-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trip-end">End Date *</Label>
              <Input
                id="trip-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                min={startDate}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="trip-notes">Notes (optional)</Label>
            <Textarea
              id="trip-notes"
              placeholder="Logistics, gear notes, contact info..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={isPublic}
              onCheckedChange={setIsPublic}
              id="trip-public"
            />
            <Label htmlFor="trip-public" className="text-sm cursor-pointer">
              Make this trip public (shareable link)
            </Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim() || !startDate || !endDate}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
              Create Trip
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TripsPage() {
  return (
    <AuthGuard>
      <TripsContent />
    </AuthGuard>
  );
}
