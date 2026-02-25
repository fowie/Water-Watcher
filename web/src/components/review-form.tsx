"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Star, Loader2 } from "lucide-react";
import { submitReview } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { ReviewRecord } from "@/lib/api";

interface ReviewFormProps {
  riverId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  existingReview?: ReviewRecord | null;
}

const DIFFICULTIES = [
  { value: "Class I", label: "Class I — Easy" },
  { value: "Class II", label: "Class II — Novice" },
  { value: "Class III", label: "Class III — Intermediate" },
  { value: "Class IV", label: "Class IV — Advanced" },
  { value: "Class V", label: "Class V — Expert" },
  { value: "Class V+", label: "Class V+ — Extreme" },
];

export function ReviewForm({ riverId, open, onOpenChange, onSuccess, existingReview }: ReviewFormProps) {
  const { toast } = useToast();
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState(existingReview?.title ?? "");
  const [body, setBody] = useState(existingReview?.body ?? "");
  const [visitDate, setVisitDate] = useState(
    existingReview?.visitDate ? existingReview.visitDate.split("T")[0] : ""
  );
  const [difficulty, setDifficulty] = useState(existingReview?.difficulty ?? "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      toast({ title: "Rating required", description: "Please select a star rating.", variant: "destructive" });
      return;
    }
    if (!body.trim()) {
      toast({ title: "Review required", description: "Please write your review.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      await submitReview(riverId, {
        rating,
        title: title.trim() || undefined,
        body: body.trim(),
        visitDate: visitDate ? new Date(visitDate).toISOString() : undefined,
        difficulty: difficulty || undefined,
      });
      toast({ title: "Review submitted!", description: "Thanks for sharing your experience.", variant: "default" });
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Failed to submit",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const displayRating = hoverRating || rating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existingReview ? "Edit Your Review" : "Write a Review"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Star selector */}
          <div className="space-y-2">
            <Label>Rating *</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  className="p-0.5 transition-transform hover:scale-110"
                  aria-label={`${star} star${star > 1 ? "s" : ""}`}
                >
                  <Star
                    className={cn(
                      "h-7 w-7 transition-colors",
                      displayRating >= star
                        ? "text-yellow-500 fill-yellow-500"
                        : "text-gray-300 dark:text-gray-600"
                    )}
                  />
                </button>
              ))}
              {displayRating > 0 && (
                <span className="ml-2 text-sm text-[var(--muted-foreground)]">
                  {displayRating}/5
                </span>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="review-title">Title (optional)</Label>
            <Input
              id="review-title"
              placeholder="Summarize your experience"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="review-body">Review *</Label>
            <Textarea
              id="review-body"
              placeholder="Tell rafters about your experience on this river..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              required
            />
          </div>

          {/* Visit date and difficulty row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="visit-date">Visit Date (optional)</Label>
              <Input
                id="visit-date"
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Perceived Difficulty (optional)</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger>
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || rating === 0 || !body.trim()}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />}
              {existingReview ? "Update Review" : "Submit Review"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
