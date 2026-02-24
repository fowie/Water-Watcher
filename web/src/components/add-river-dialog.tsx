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
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { createRiver } from "@/lib/api";

interface AddRiverDialogProps {
  onRiverAdded?: () => void;
}

export function AddRiverDialog({ onRiverAdded }: AddRiverDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setLoading(true);
      setError(null);

      const form = new FormData(e.currentTarget);
      const data = {
        name: form.get("name") as string,
        state: form.get("state") as string,
        region: (form.get("region") as string) || undefined,
        difficulty: (form.get("difficulty") as string) || undefined,
        description: (form.get("description") as string) || undefined,
        awId: (form.get("awId") as string) || undefined,
        usgsGaugeId: (form.get("usgsGaugeId") as string) || undefined,
      };

      try {
        await createRiver(data);
        setOpen(false);
        onRiverAdded?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add river");
      } finally {
        setLoading(false);
      }
    },
    [onRiverAdded]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Add River
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add a River</DialogTitle>
            <DialogDescription>
              Start tracking conditions for a new river. You can link USGS
              gauge stations and American Whitewater pages for automated
              updates.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">River Name *</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g., Colorado River"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="state">State *</Label>
                <Input
                  id="state"
                  name="state"
                  placeholder="e.g., Colorado"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="region">Region</Label>
                <Input
                  id="region"
                  name="region"
                  placeholder="e.g., Western Slope"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="difficulty">Difficulty</Label>
              <Input
                id="difficulty"
                name="difficulty"
                placeholder="e.g., Class III-IV"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Brief description of the river..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="awId">AW ID</Label>
                <Input
                  id="awId"
                  name="awId"
                  placeholder="American Whitewater ID"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="usgsGaugeId">USGS Gauge ID</Label>
                <Input
                  id="usgsGaugeId"
                  name="usgsGaugeId"
                  placeholder="e.g., 09058000"
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
              {loading ? "Adding..." : "Add River"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
