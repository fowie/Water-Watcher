import { Skeleton } from "@/components/ui/skeleton";

export default function SearchLoading() {
  return (
    <main className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-60" />
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-16" />
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    </main>
  );
}
