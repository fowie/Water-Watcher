import { Skeleton } from "@/components/ui/skeleton";

export default function MapLoading() {
  return (
    <main className="relative h-[calc(100vh-3.5rem)] md:h-screen">
      <Skeleton className="h-full w-full" />
    </main>
  );
}
