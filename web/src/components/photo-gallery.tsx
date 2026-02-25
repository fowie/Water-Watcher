"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getRiverPhotos, type RiverPhotoRecord } from "@/lib/api";
import { cn, timeAgo } from "@/lib/utils";
import { X, ChevronLeft, ChevronRight, Camera, Loader2 } from "lucide-react";

interface PhotoGalleryProps {
  riverId: string;
  refreshKey?: number;
}

export function PhotoGallery({ riverId, refreshKey }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<RiverPhotoRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 12;

  const loadPhotos = useCallback(async (loadOffset: number, append: boolean) => {
    try {
      setLoading(true);
      const data = await getRiverPhotos(riverId, { limit: LIMIT, offset: loadOffset });
      setTotal(data.total);
      setPhotos((prev) => (append ? [...prev, ...data.photos] : data.photos));
      setHasMore(loadOffset + data.photos.length < data.total);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [riverId]);

  // Initial load and refresh
  useEffect(() => {
    setOffset(0);
    loadPhotos(0, false);
  }, [loadPhotos, refreshKey]);

  // Intersection observer for lazy loading
  useEffect(() => {
    if (!hasMore || loading) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading) {
          const newOffset = offset + LIMIT;
          setOffset(newOffset);
          loadPhotos(newOffset, true);
        }
      },
      { threshold: 0.1 }
    );

    const sentinel = sentinelRef.current;
    if (sentinel) observerRef.current.observe(sentinel);

    return () => {
      if (sentinel && observerRef.current) observerRef.current.unobserve(sentinel);
    };
  }, [hasMore, loading, offset, loadPhotos]);

  // Lightbox keyboard navigation
  useEffect(() => {
    if (lightboxIndex === null) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowRight") setLightboxIndex((i) => (i !== null && i < photos.length - 1 ? i + 1 : i));
      if (e.key === "ArrowLeft") setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i));
    }
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [lightboxIndex, photos.length]);

  if (loading && photos.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--muted-foreground)]" />
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <div className="flex justify-center">
          <div className="rounded-full bg-[var(--muted)] p-4">
            <Camera className="h-8 w-8 text-[var(--muted-foreground)]" aria-hidden="true" />
          </div>
        </div>
        <p className="text-[var(--muted-foreground)] text-sm">No photos yet. Be the first to add one!</p>
      </div>
    );
  }

  return (
    <>
      {/* Photo count badge */}
      <p className="text-sm text-[var(--muted-foreground)] mb-3">
        {total} photo{total !== 1 ? "s" : ""}
      </p>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {photos.map((photo, idx) => (
          <button
            key={photo.id}
            onClick={() => setLightboxIndex(idx)}
            className="relative aspect-[4/3] rounded-lg overflow-hidden group focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          >
            <img
              src={photo.url}
              alt={photo.caption ?? "River photo"}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
            {photo.caption && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white text-xs truncate">{photo.caption}</p>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Lazy loading sentinel */}
      {hasMore && <div ref={sentinelRef} className="h-8" />}
      {loading && photos.length > 0 && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--muted-foreground)]" />
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90" role="dialog" aria-modal="true">
          {/* Close button */}
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 z-10"
            aria-label="Close lightbox"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Previous */}
          {lightboxIndex > 0 && (
            <button
              onClick={() => setLightboxIndex(lightboxIndex - 1)}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 z-10"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
          )}

          {/* Next */}
          {lightboxIndex < photos.length - 1 && (
            <button
              onClick={() => setLightboxIndex(lightboxIndex + 1)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white p-2 z-10"
              aria-label="Next photo"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          )}

          {/* Image */}
          <img
            src={photos[lightboxIndex].url}
            alt={photos[lightboxIndex].caption ?? "River photo"}
            className="max-w-[90vw] max-h-[85vh] object-contain"
          />

          {/* Caption */}
          <div className="absolute bottom-0 inset-x-0 p-4 text-center">
            {photos[lightboxIndex].caption && (
              <p className="text-white text-sm mb-1">{photos[lightboxIndex].caption}</p>
            )}
            <p className="text-white/60 text-xs">
              {lightboxIndex + 1} / {photos.length}
              {photos[lightboxIndex].user?.name && ` • ${photos[lightboxIndex].user.name}`}
              {photos[lightboxIndex].createdAt && ` • ${timeAgo(photos[lightboxIndex].createdAt)}`}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
