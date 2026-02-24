"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConditionBadge } from "./condition-badge";
import { Droplets, AlertTriangle, Users, ChevronRight } from "lucide-react";
import { formatFlowRate } from "@/lib/utils";
import type { RiverSummary } from "@/types";

interface RiverCardProps {
  river: RiverSummary;
}

export function RiverCard({ river }: RiverCardProps) {
  const cond = river.latestCondition;
  const timeAgo = cond?.scrapedAt
    ? getRelativeTime(new Date(cond.scrapedAt))
    : null;

  return (
    <Link href={`/rivers/${river.id}`}>
      <Card className="group hover:shadow-md transition-shadow cursor-pointer h-full">
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
          </div>

          {/* Footer */}
          {timeAgo && (
            <p className="text-xs text-[var(--muted-foreground)]">
              Updated {timeAgo}
            </p>
          )}
        </CardContent>
      </Card>
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
