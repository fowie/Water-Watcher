"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConditionBadge } from "./condition-badge";
import { ConditionSparkline } from "./condition-sparkline";
import { Droplets, AlertTriangle, Users, ChevronRight, Trash2, Star } from "lucide-react";
import { formatFlowRate } from "@/lib/utils";
import { deleteRiver } from "@/lib/api";
import type { RiverSummary } from "@/types";

interface RiverCardProps {
  river: RiverSummary;
  onDelete?: () => void;
  /** Whether this river is in the user's favorites */
  isFavorited?: boolean;
  /** Called when the user toggles the favorite star */
  onToggleFavorite?: () => void;
  /** Whether the card is in "selection mode" for comparison */
  selectable?: boolean;
  /** Whether the card is currently selected for comparison */
  selected?: boolean;
  /** Called when the card is selected/deselected */
  onSelect?: (riverId: string) => void;
  /** Optional recent flow rate data for sparkline (last 7 values) */
  sparklineData?: (number | null)[];
}, sparklineData

export function RiverCard({ river, onDelete, isFavorited, onToggleFavorite, selectable, selected, onSelect }: RiverCardProps) {
  const cond = river.latestCondition;
  const timeAgo = cond?.scrapedAt
    ? getRelativeTime(new Date(cond.scrapedAt))
    : null;

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Delete "${river.name}"? This cannot be undone.`)) return;
    try {
      await deleteRiver(river.id);
      onDelete?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete river");
    }
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleFavorite?.();
  };

  const handleSelect = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect?.(river.id);
  };

  const cardContent = (
    <Card className={`group hover:shadow-md transition-shadow cursor-pointer h-full relative ${selectable && selected ? "ring-2 ring-[var(--primary)]" : ""}`}>
      {/* Action buttons — top right */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
        {onToggleFavorite && (
          <button
            onClick={handleFavorite}
            className={`p-1.5 rounded-md transition-all ${
              isFavorited
                ? "text-yellow-500 opacity-100"
                : "opacity-0 group-hover:opacity-100 focus:opacity-100 text-[var(--muted-foreground)] hover:text-yellow-500"
            }`}
            title={isFavorited ? "Remove from tracked rivers" : "Track this river"}
            aria-label={isFavorited ? `Untrack ${river.name}` : `Track ${river.name}`}
          >
            <Star className={`h-4 w-4 ${isFavorited ? "fill-current" : ""}`} aria-hidden="true" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={handleDelete}
            className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity bg-[var(--muted)] hover:bg-[var(--destructive)] hover:text-white text-[var(--muted-foreground)]"
            title="Delete river"
            aria-label={`Delete ${river.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
        {selectable && (
          <button
            onClick={handleSelect}
            className={`p-1.5 rounded-md border transition-colors ${
              selected
                ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                : "border-[var(--border)] bg-[var(--background)] hover:bg-[var(--secondary)]"
            }`}
            title={selected ? "Deselect" : "Select for comparison"}
            aria-label={selected ? `Deselect ${river.name}` : `Select ${river.name} for comparison`}
          >
            <div className={`h-3.5 w-3.5 flex items-center justify-center text-xs font-bold ${selected ? "" : "opacity-50"}`}>
              {selected ? "✓" : ""}
            </div>
          </button>
        )}
      </div>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1 min-w-0">
              <CardTitle className="text-lg truncate group-hover:text-[var(--primary)] transition-colors">
                {river.name}
              </CardTitle>
              <p className="text-sm text-[var(--muted-foreground)]">
                {river.state}
                {river.difficulty && (
                  <span className="ml-2 font-medium">{river.difficulty}</span>
                )}
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-[var(--muted-foreground)] group-hover:text-[var(--primary)] transition-colors shrink-0 mt-1" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Condition */}
          <div className="flex items-center gap-2 flex-wrap">
            {cond?.quality && <ConditionBadge quality={cond.quality} />}
            {cond?.runnability && (
              <Badge variant="secondary" className="capitalize">
                {cond.runnability.replace("_", " ")}
              </Badge>
            )}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 text-sm text-[var(--muted-foreground)]">
            {cond?.flowRate != null && (
              <span className="flex items-center gap-1">
                <Droplets className="h-3.5 w-3.5" />
                {formatFlowRate(cond.flowRate)}
              </span>
            )}
            {river.activeHazardCount > 0 && (
              <span className="flex items-center gap-1 text-orange-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                {river.activeHazardCount} hazard
                {river.activeHazardCount !== 1 ? "s" : ""}
              </span>
            )}
            {river.trackerCount > 0 && (
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {river.trackerCount}
              </span>
            )}
            {/* Sparkline — shows flow trend for last 7 days */}
            {sparklineData && sparklineData.length >= 2 && (
              <span className="ml-auto">
                <ConditionSparkline
                  data={sparklineData}
                  label={`${river.name} flow trend`}
                />
              </span>
            )}
          </div>

          {/* Footer */}
          {timeAgo && (
            <p className="text-xs text-[var(--muted-foreground)]">
              Updated {timeAgo}
            </p>
          )}
        </CardContent>
      </Card>
  );

  // In selection mode, clicking the card selects it (no navigation)
  if (selectable) {
    return (
      <div onClick={handleSelect} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect?.(river.id); } }}>
        {cardContent}
      </div>
    );
  }

  return (
    <Link href={`/rivers/${river.id}`}>
      {cardContent}
    </Link>
  );
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}
