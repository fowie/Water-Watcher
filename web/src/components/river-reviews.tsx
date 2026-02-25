"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { RapidRating } from "@/components/rapid-rating";
import { ConditionBadge } from "@/components/condition-badge";
import {
  Star,
  StarHalf,
  MessageSquare,
  ArrowUpDown,
  Loader2,
  Pencil,
  User,
  Calendar,
} from "lucide-react";
import { getRiverReviews } from "@/lib/api";
import { timeAgo, cn } from "@/lib/utils";
import type { ReviewRecord, ReviewsResponse } from "@/lib/api";

interface RiverReviewsProps {
  riverId: string;
  onWriteReview: () => void;
}

type SortOption = "recent" | "highest" | "lowest";

export function RiverReviews({ riverId, onWriteReview }: RiverReviewsProps) {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const [reviewsData, setReviewsData] = useState<ReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>("recent");

  const loadReviews = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRiverReviews(riverId, { limit: 100 });
      setReviewsData(data);
    } catch {
      setReviewsData(null);
    } finally {
      setLoading(false);
    }
  }, [riverId]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const sortedReviews = useMemo(() => {
    if (!reviewsData?.reviews) return [];
    const sorted = [...reviewsData.reviews];
    switch (sortBy) {
      case "highest":
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      case "lowest":
        sorted.sort((a, b) => a.rating - b.rating);
        break;
      case "recent":
      default:
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }
    return sorted;
  }, [reviewsData, sortBy]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const avgRating = reviewsData?.averageRating ?? null;
  const totalReviews = reviewsData?.total ?? 0;

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <StarRating rating={avgRating ?? 0} size="lg" />
          </div>
          <span className="text-lg font-medium">
            {avgRating != null ? avgRating.toFixed(1) : "—"}
          </span>
          <span className="text-sm text-[var(--muted-foreground)]">
            ({totalReviews} {totalReviews === 1 ? "review" : "reviews"})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Sort */}
          <div className="flex items-center gap-1 text-sm">
            <ArrowUpDown className="h-4 w-4 text-[var(--muted-foreground)]" aria-hidden="true" />
            {(["recent", "highest", "lowest"] as SortOption[]).map((opt) => (
              <button
                key={opt}
                onClick={() => setSortBy(opt)}
                className={cn(
                  "px-2 py-1 rounded text-xs font-medium transition-colors",
                  sortBy === opt
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--secondary)]"
                )}
              >
                {opt === "recent" ? "Most Recent" : opt === "highest" ? "Highest" : "Lowest"}
              </button>
            ))}
          </div>
          {isAuthenticated && (
            <Button size="sm" onClick={onWriteReview}>
              <Pencil className="h-4 w-4 mr-1" aria-hidden="true" />
              Write Review
            </Button>
          )}
        </div>
      </div>

      {/* Reviews list */}
      {sortedReviews.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No reviews yet"
          description="Be the first to review this river and help fellow rafters."
        >
          {isAuthenticated && (
            <Button onClick={onWriteReview} className="mt-4">
              Write the First Review
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {sortedReviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ review }: { review: ReviewRecord }) {
  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[var(--muted)] flex items-center justify-center shrink-0">
              {review.user.image ? (
                <img src={review.user.image} alt="" className="w-8 h-8 rounded-full" />
              ) : (
                <User className="h-4 w-4 text-[var(--muted-foreground)]" aria-hidden="true" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">{review.user.name ?? "Anonymous"}</p>
              <div className="flex items-center gap-2">
                <StarRating rating={review.rating} size="sm" />
                <span className="text-xs text-[var(--muted-foreground)]">
                  {timeAgo(review.createdAt)}
                </span>
              </div>
            </div>
          </div>
          {review.difficulty && (
            <RapidRating difficulty={review.difficulty} />
          )}
        </div>

        {review.title && (
          <h4 className="font-medium">{review.title}</h4>
        )}
        <p className="text-sm text-[var(--foreground)] leading-relaxed">{review.body}</p>

        {review.visitDate && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
            <Calendar className="h-3 w-3" aria-hidden="true" />
            Visited {new Date(review.visitDate).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Star Rating Display ──────────────────────────────

interface StarRatingProps {
  rating: number;
  size?: "sm" | "lg";
}

export function StarRating({ rating, size = "sm" }: StarRatingProps) {
  const iconSize = size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5";
  const stars = [];

  for (let i = 1; i <= 5; i++) {
    if (rating >= i) {
      stars.push(
        <Star key={i} className={cn(iconSize, "text-yellow-500 fill-yellow-500")} aria-hidden="true" />
      );
    } else if (rating >= i - 0.5) {
      stars.push(
        <StarHalf key={i} className={cn(iconSize, "text-yellow-500 fill-yellow-500")} aria-hidden="true" />
      );
    } else {
      stars.push(
        <Star key={i} className={cn(iconSize, "text-gray-300 dark:text-gray-600")} aria-hidden="true" />
      );
    }
  }

  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {stars}
    </div>
  );
}
