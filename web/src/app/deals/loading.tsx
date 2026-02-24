import { Skeleton } from "@/components/ui/skeleton";

export default function DealsLoading() {
  return (
    <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-60" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      {/* Filter bar */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Deals grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[var(--radius)] border border-[var(--border)] overflow-hidden"
          >
            <Skeleton className="h-40 w-full rounded-none" />
            <div className="p-4 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex justify-between items-center pt-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
