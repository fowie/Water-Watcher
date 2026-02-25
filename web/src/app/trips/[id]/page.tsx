"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { RapidRating } from "@/components/rapid-rating";
import { WeatherWidget } from "@/components/weather-widget";
import { RiverPickerDialog } from "@/components/river-picker-dialog";
import { AuthGuard } from "@/components/auth-guard";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Plus,
  X,
  Share2,
  Trash2,
  Loader2,
  Calendar,
  MapPin,
  Pencil,
  CheckCircle2,
  XCircle,
  PlayCircle,
  Clock,
} from "lucide-react";
import {
  getTrip,
  updateTrip,
  deleteTrip,
  addTripStop,
  removeTripStop,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn, timeAgo } from "@/lib/utils";
import type { TripRecord, TripStopRecord } from "@/lib/api";
import type { RiverSummary } from "@/types";

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  planning: { label: "Planning", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  active: { label: "Active", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  completed: { label: "Completed", className: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
};

function TripDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params.id as string;

  const [trip, setTrip] = useState<TripRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  // River picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerDay, setPickerDay] = useState(1);

  const loadTrip = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTrip(id);
      setTrip(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trip");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTrip();
  }, [loadTrip]);

  // Grouped stops by day
  const dayStops = useMemo(() => {
    if (!trip) return {};
    const groups: Record<number, TripStopRecord[]> = {};
    const sorted = [...(trip.stops ?? [])].sort((a, b) => {
      if (a.dayNumber !== b.dayNumber) return a.dayNumber - b.dayNumber;
      return a.sortOrder - b.sortOrder;
    });
    for (const stop of sorted) {
      if (!groups[stop.dayNumber]) groups[stop.dayNumber] = [];
      groups[stop.dayNumber].push(stop);
    }
    return groups;
  }, [trip]);

  const totalDays = useMemo(() => {
    if (!trip) return 1;
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  }, [trip]);

  const handleEdit = () => {
    if (!trip) return;
    setEditName(trip.name);
    setEditNotes(trip.notes ?? "");
    setEditStartDate(trip.startDate.split("T")[0]);
    setEditEndDate(trip.endDate.split("T")[0]);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!trip) return;
    setSaving(true);
    try {
      await updateTrip(id, {
        name: editName.trim(),
        notes: editNotes.trim() || null,
        startDate: new Date(editStartDate).toISOString(),
        endDate: new Date(editEndDate).toISOString(),
      });
      toast({ title: "Trip updated" });
      setEditing(false);
      loadTrip();
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (status: "active" | "completed" | "cancelled") => {
    try {
      await updateTrip(id, { status });
      toast({ title: `Trip marked as ${status}` });
      loadTrip();
    } catch (err) {
      toast({ title: "Status update failed", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this trip? This cannot be undone.")) return;
    try {
      await deleteTrip(id);
      toast({ title: "Trip deleted" });
      router.push("/trips");
    } catch (err) {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const handleAddRiver = (dayNumber: number) => {
    setPickerDay(dayNumber);
    setPickerOpen(true);
  };

  const handleRiverSelected = async (river: RiverSummary) => {
    try {
      const existingDay = dayStops[pickerDay] ?? [];
      await addTripStop(id, {
        riverId: river.id,
        dayNumber: pickerDay,
        sortOrder: existingDay.length,
      });
      toast({ title: `Added ${river.name}` });
      loadTrip();
    } catch (err) {
      toast({ title: "Failed to add river", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
    }
  };

  const handleRemoveStop = async (stopId: string) => {
    if (!window.confirm("Remove this stop?")) return;
    try {
      await removeTripStop(id, stopId);
      toast({ title: "Stop removed" });
      loadTrip();
    } catch (err) {
      toast({ title: "Remove failed", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/trips/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied!", description: "Trip link copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <main className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-64" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </main>
    );
  }

  if (error || !trip) {
    return (
      <main className="p-4 md:p-8 max-w-4xl mx-auto text-center py-20 space-y-4">
        <p className="text-[var(--destructive)] font-medium">{error ?? "Trip not found"}</p>
        <Link href="/trips">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Trips
          </Button>
        </Link>
      </main>
    );
  }

  const statusStyle = STATUS_STYLES[trip.status] ?? STATUS_STYLES.planning;

  return (
    <main className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/trips"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Trips
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          {editing ? (
            <div className="space-y-3 max-w-md">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-lg font-bold"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} />
                <Input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} min={editStartDate} />
              </div>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Notes..."
                rows={2}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-bold">{trip.name}</h1>
                <Badge className={statusStyle.className} variant="secondary">
                  {statusStyle.label}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-[var(--muted-foreground)]">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" aria-hidden="true" />
                  {new Date(trip.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} –{" "}
                  {new Date(trip.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  {trip.stops?.length ?? 0} stops
                </span>
              </div>
              {trip.notes && (
                <p className="text-sm text-[var(--muted-foreground)] max-w-2xl">{trip.notes}</p>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        {!editing && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleEdit}>
              <Pencil className="h-4 w-4 mr-1" aria-hidden="true" />
              Edit
            </Button>
            {trip.isPublic && (
              <Button size="sm" variant="outline" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-1" aria-hidden="true" />
                Share
              </Button>
            )}
            {trip.status === "planning" && (
              <Button size="sm" variant="outline" onClick={() => handleStatusChange("active")}>
                <PlayCircle className="h-4 w-4 mr-1" aria-hidden="true" />
                Start Trip
              </Button>
            )}
            {trip.status === "active" && (
              <Button size="sm" variant="outline" onClick={() => handleStatusChange("completed")}>
                <CheckCircle2 className="h-4 w-4 mr-1" aria-hidden="true" />
                Complete
              </Button>
            )}
            {(trip.status === "planning" || trip.status === "active") && (
              <Button size="sm" variant="outline" onClick={() => handleStatusChange("cancelled")}>
                <XCircle className="h-4 w-4 mr-1" aria-hidden="true" />
                Cancel
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1" aria-hidden="true" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Day-by-day itinerary */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold">Itinerary</h2>
        {Array.from({ length: totalDays }, (_, i) => i + 1).map((dayNum) => {
          const stops = dayStops[dayNum] ?? [];
          const dayDate = new Date(trip.startDate);
          dayDate.setDate(dayDate.getDate() + dayNum - 1);
          const dateStr = dayDate.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          });

          return (
            <Card key={dayNum}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Day {dayNum}
                    <span className="ml-2 text-sm font-normal text-[var(--muted-foreground)]">
                      {dateStr}
                    </span>
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddRiver(dayNum)}
                  >
                    <Plus className="h-4 w-4 mr-1" aria-hidden="true" />
                    Add River
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {stops.length === 0 ? (
                  <p className="text-sm text-[var(--muted-foreground)] py-4 text-center">
                    No stops planned for this day
                  </p>
                ) : (
                  <div className="space-y-3">
                    {stops.map((stop, idx) => (
                      <div
                        key={stop.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-[var(--muted)]/50 relative group"
                      >
                        {/* Timeline indicator */}
                        <div className="flex flex-col items-center gap-1 pt-1 shrink-0">
                          <div className="w-3 h-3 rounded-full bg-[var(--primary)]" />
                          {idx < stops.length - 1 && (
                            <div className="w-px h-8 bg-[var(--border)]" />
                          )}
                        </div>

                        {/* Stop info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/rivers/${stop.riverId}`}
                              className="font-medium text-sm hover:text-[var(--primary)] transition-colors"
                            >
                              {stop.river.name}
                            </Link>
                            {stop.river.difficulty && (
                              <RapidRating difficulty={stop.river.difficulty} />
                            )}
                            <span className="text-xs text-[var(--muted-foreground)]">
                              {stop.river.state}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-[var(--muted-foreground)]">
                            {stop.putInTime && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" aria-hidden="true" />
                                Put-in: {stop.putInTime}
                              </span>
                            )}
                            {stop.takeOutTime && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" aria-hidden="true" />
                                Take-out: {stop.takeOutTime}
                              </span>
                            )}
                          </div>
                          {stop.notes && (
                            <p className="text-xs text-[var(--muted-foreground)] mt-1">{stop.notes}</p>
                          )}
                        </div>

                        {/* Remove button */}
                        <button
                          onClick={() => handleRemoveStop(stop.id)}
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-[var(--muted-foreground)] hover:text-red-600 transition-all shrink-0"
                          aria-label={`Remove ${stop.river.name}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* River picker dialog */}
      <RiverPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleRiverSelected}
      />
    </main>
  );
}

export default function TripDetailPage() {
  return (
    <AuthGuard>
      <TripDetailContent />
    </AuthGuard>
  );
}
