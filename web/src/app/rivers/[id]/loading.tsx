import { Skeleton } from "@/components/ui/skeleton";

export default function RiverDetailLoading() {
  return (
    <main className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <Skeleton className="h-4 w-32" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-10 rounded-md" />
          <Skeleton className="h-10 w-10 rounded-md" />
        </div>
      </div>

      {/* Quick stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[var(--radius)] border border-[var(--border)] p-4 space-y-2"
          >
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>

      {/* Tabs skeleton */}
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-1 rounded-[var(--radius)] bg-[var(--muted)] p-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 rounded-[var(--radius)]" />
          ))}
        </div>

        {/* Tab content skeleton */}
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[var(--radius)] border border-[var(--border)] p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
