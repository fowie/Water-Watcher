import { Skeleton } from "@/components/ui/skeleton";

export default function GlobalLoading() {
  return (
    <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Card grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[var(--radius)] border border-[var(--border)] p-4 space-y-3"
          >
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-1/3 mt-2" />
          </div>
        ))}
      </div>
    </main>
  );
}
