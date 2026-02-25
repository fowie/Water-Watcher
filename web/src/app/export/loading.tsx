import { Skeleton } from "@/components/ui/skeleton";

export default function ExportLoading() {
  return (
    <main className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-12 w-40" />
    </main>
  );
}
