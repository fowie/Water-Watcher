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
import { Pencil, Loader2 } from "lucide-react";
import { updateRiver } from "@/lib/api";
import { riverUpdateSchema } from "@/lib/validations";
import { toast } from "@/hooks/use-toast";
import type { RiverDetail } from "@/types";

interface EditRiverDialogProps {
  river: RiverDetail;
  onRiverUpdated?: () => void;
}

export function EditRiverDialog({ river, onRiverUpdated }: EditRiverDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setLoading(true);

      const form = new FormData(e.currentTarget);
      const raw = {
        name: (form.get("name") as string) || undefined,
        state: (form.get("state") as string) || undefined,
        region: (form.get("region") as string) || null,
        difficulty: (form.get("difficulty") as string) || null,
        description: (form.get("description") as string) || null,
        latitude: form.get("latitude")
          ? Number(form.get("latitude"))
          : null,
        longitude: form.get("longitude")
          ? Number(form.get("longitude"))
          : null,
      };

      const result = riverUpdateSchema.safeParse(raw);
      if (!result.success) {
        const firstError = result.error.issues[0]?.message ?? "Validation failed";
        toast({
          title: "Validation error",
          description: firstError,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      try {
        await updateRiver(river.id, result.data);
        toast({
          title: "River updated",
          description: `"${raw.name || river.name}" has been updated.`,
          variant: "success",
        });
        setOpen(false);
        onRiverUpdated?.();
      } catch (err) {
        toast({
          title: "Update failed",
          description: err instanceof Error ? err.message : "Failed to update river",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [river, onRiverUpdated]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Edit river details">
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit River</DialogTitle>
            <DialogDescription>
              Update details for {river.name}. Changes take effect immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">River Name</Label>
              <Input
                id="edit-name"
                name="name"
                defaultValue={river.name}
                placeholder="e.g., Colorado River"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-state">State</Label>
                <Input
                  id="edit-state"
                  name="state"
                  defaultValue={river.state}
                  placeholder="e.g., Colorado"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-region">Region</Label>
                <Input
                  id="edit-region"
                  name="region"
                  defaultValue={river.region ?? ""}
                  placeholder="e.g., Western Slope"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-difficulty">Difficulty</Label>
              <Input
                id="edit-difficulty"
                name="difficulty"
                defaultValue={river.difficulty ?? ""}
                placeholder="e.g., Class III-IV"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-latitude">Latitude</Label>
                <Input
                  id="edit-latitude"
                  name="latitude"
                  type="number"
                  step="any"
                  defaultValue={river.latitude ?? ""}
                  placeholder="-90 to 90"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-longitude">Longitude</Label>
                <Input
                  id="edit-longitude"
                  name="longitude"
                  type="number"
                  step="any"
                  defaultValue={river.longitude ?? ""}
                  placeholder="-180 to 180"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                name="description"
                defaultValue={river.description ?? ""}
                placeholder="Brief description of the river..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
