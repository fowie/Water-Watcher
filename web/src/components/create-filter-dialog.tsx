"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { createDealFilter } from "@/lib/api";

const CATEGORIES = [
  { value: "raft", label: "Raft" },
  { value: "kayak", label: "Kayak" },
  { value: "paddle", label: "Paddle" },
  { value: "pfd", label: "PFD" },
  { value: "drysuit", label: "Drysuit" },
  { value: "other", label: "Other" },
];

interface CreateFilterDialogProps {
  userId: string;
  onFilterCreated?: () => void;
}

export function CreateFilterDialog({
  userId,
  onFilterCreated,
}: CreateFilterDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const addKeyword = useCallback(() => {
    const kw = keywordInput.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords((prev) => [...prev, kw]);
      setKeywordInput("");
    }
  }, [keywordInput, keywords]);

  const removeKeyword = useCallback((kw: string) => {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  }, []);

  const toggleCategory = useCallback((cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (keywords.length === 0) {
        setError("Add at least one keyword");
        return;
      }
      setLoading(true);
      setError(null);

      const form = new FormData(e.currentTarget);
      const data = {
        name: form.get("name") as string,
        keywords,
        categories: selectedCategories,
        maxPrice: form.get("maxPrice")
          ? Number(form.get("maxPrice"))
          : undefined,
        regions: (form.get("regions") as string)
          ?.split(",")
          .map((r) => r.trim())
          .filter(Boolean) ?? [],
        isActive: true,
      };

      try {
        await createDealFilter(userId, data);
        setOpen(false);
        setKeywords([]);
        setSelectedCategories([]);
        onFilterCreated?.();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create filter"
        );
      } finally {
        setLoading(false);
      }
    },
    [keywords, selectedCategories, userId, onFilterCreated]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Create Alert
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Deal Alert</DialogTitle>
            <DialogDescription>
              Set up a filter to get notified when matching gear deals appear on
              Craigslist.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="filterName">Alert Name *</Label>
              <Input
                id="filterName"
                name="name"
                placeholder="e.g., Cheap Rafts"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label>Keywords *</Label>
              <div className="flex gap-2">
                <Input
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  placeholder="Add a keyword..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addKeyword();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addKeyword} size="icon">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {keywords.map((kw) => (
                    <Badge
                      key={kw}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => removeKeyword(kw)}
                    >
                      {kw}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Categories</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <Badge
                    key={cat.value}
                    variant={
                      selectedCategories.includes(cat.value)
                        ? "default"
                        : "outline"
                    }
                    className="cursor-pointer"
                    onClick={() => toggleCategory(cat.value)}
                  >
                    {cat.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="maxPrice">Max Price ($)</Label>
                <Input
                  id="maxPrice"
                  name="maxPrice"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="No limit"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="regions">Regions</Label>
                <Input
                  id="regions"
                  name="regions"
                  placeholder="e.g., denver, boulder"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-[var(--destructive)] mb-4">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Alert"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
