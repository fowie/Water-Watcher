"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, ChevronRight } from "lucide-react";
import type { TripRecord } from "@/lib/api";

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  planning: { label: "Planning", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  active: { label: "Active", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  completed: { label: "Completed", className: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
};

interface TripCardProps {
  trip: TripRecord;
}

export function TripCard({ trip }: TripCardProps) {
  const statusStyle = STATUS_STYLES[trip.status] ?? STATUS_STYLES.planning;
  const stopCount = trip._count?.stops ?? trip.stops?.length ?? 0;

  const formatDateRange = () => {
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    const startStr = start.toLocaleDateString("en-US", opts);
    const endStr = end.toLocaleDateString("en-US", { ...opts, year: "numeric" });
    return `${startStr} – ${endStr}`;
  };

  const dayCount = () => {
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff;
  };

  return (
    <Link href={`/trips/${trip.id}`}>
      <Card className="group hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg group-hover:text-[var(--primary)] transition-colors line-clamp-1">
              {trip.name}
            </CardTitle>
            <Badge className={statusStyle.className} variant="secondary">
              {statusStyle.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{formatDateRange()}</span>
            <span className="text-xs">({dayCount()} days)</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {stopCount} {stopCount === 1 ? "river stop" : "river stops"}
            </span>
          </div>
          {trip.notes && (
            <p className="text-xs text-[var(--muted-foreground)] line-clamp-2">
              {trip.notes}
            </p>
          )}
          <div className="flex justify-end">
            <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)] group-hover:text-[var(--primary)] transition-colors" aria-hidden="true" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
