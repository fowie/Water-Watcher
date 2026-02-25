"use client";

import { useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { uploadRiverPhoto } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Camera, Upload, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PhotoUploadProps {
  riverId: string;
  onUploadComplete: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function PhotoUpload({ riverId, onUploadComplete }: PhotoUploadProps) {
  const { status } = useSession();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [takenAt, setTakenAt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPreview(null);
    setCaption("");
    setTakenAt("");
    setError(null);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > MAX_FILE_SIZE) {
        setError("File size must be under 5MB");
        e.target.value = "";
        return;
      }

      if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
        setError("Only JPG, PNG, and WebP images are supported");
        e.target.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    },
    []
  );

  const handleUpload = useCallback(async () => {
    if (!preview) return;

    setUploading(true);
    setError(null);
    try {
      await uploadRiverPhoto(riverId, {
        url: preview,
        caption: caption.trim() || undefined,
        takenAt: takenAt ? new Date(takenAt).toISOString() : undefined,
      });
      toast({
        title: "Photo uploaded",
        description: "Your photo has been added to the gallery.",
        variant: "default",
      });
      reset();
      setOpen(false);
      onUploadComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [preview, riverId, caption, takenAt, toast, reset, onUploadComplete]);

  if (status !== "authenticated") return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Camera className="h-4 w-4 mr-1.5" aria-hidden="true" />
          Add Photo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Photo</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* File input */}
          <div className="space-y-2">
            <Label htmlFor="photo-file">Photo</Label>
            <Input
              ref={fileInputRef}
              id="photo-file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="cursor-pointer"
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              JPG, PNG, or WebP • Max 5MB
            </p>
          </div>

          {/* Preview */}
          {preview && (
            <div className="relative rounded-lg overflow-hidden border border-[var(--border)]">
              <img
                src={preview}
                alt="Preview"
                className="w-full max-h-48 object-contain bg-[var(--muted)]"
              />
              <button
                onClick={() => {
                  setPreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="absolute top-2 right-2 rounded-full bg-black/60 text-white p-1 hover:bg-black/80"
                aria-label="Remove photo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Caption */}
          <div className="space-y-2">
            <Label htmlFor="photo-caption">Caption (optional)</Label>
            <Input
              id="photo-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption..."
              maxLength={500}
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="photo-date">Date taken (optional)</Label>
            <Input
              id="photo-date"
              type="date"
              value={takenAt}
              onChange={(e) => setTakenAt(e.target.value)}
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-[var(--destructive)]">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!preview || uploading}>
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" aria-hidden="true" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-1.5" aria-hidden="true" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
