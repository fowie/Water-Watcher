"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, MapPin, Clock, DollarSign, ImageOff } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { GearDealRecord } from "@/types";

interface DealCardProps {
  deal: GearDealRecord;
}

export function DealCard({ deal }: DealCardProps) {
  const timeAgo = deal.postedAt
    ? getRelativeTime(new Date(deal.postedAt))
    : null;

  return (
    <Card className="group hover:shadow-md transition-shadow h-full flex flex-col">
      {/* Image */}
      <div className="aspect-[4/3] relative overflow-hidden rounded-t-lg bg-[var(--muted)]">
        {deal.imageUrl ? (
          <img
            src={deal.imageUrl}
            alt={deal.title}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <ImageOff className="h-10 w-10 text-[var(--muted-foreground)]" />
          </div>
        )}
        {deal.price != null && (
          <div className="absolute top-2 right-2 bg-[var(--background)]/90 backdrop-blur-sm px-2 py-1 rounded-md font-bold text-sm flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5" />
            {deal.price.toFixed(0)}
          </div>
        )}
      </div>

      <CardContent className="p-4 flex-1 flex flex-col">
        <h3 className="font-semibold text-sm line-clamp-2 mb-2 group-hover:text-[var(--primary)] transition-colors">
          {deal.title}
        </h3>

        <div className="flex items-center gap-2 flex-wrap mb-2">
          {deal.category && (
            <Badge variant="secondary" className="capitalize text-xs">
              {deal.category}
            </Badge>
          )}
        </div>

        {deal.description && (
          <p className="text-xs text-[var(--muted-foreground)] line-clamp-2 mb-3">
            {deal.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between text-xs text-[var(--muted-foreground)]">
          <div className="flex items-center gap-3">
            {deal.region && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {deal.region}
              </span>
            )}
            {timeAgo && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {timeAgo}
              </span>
            )}
          </div>
          <a
            href={deal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[var(--primary)] hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            View <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>
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
