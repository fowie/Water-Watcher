import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function RiverNotFound() {
  return (
    <main className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="max-w-md w-full text-center">
        <CardContent className="p-8 space-y-6">
          <div className="text-5xl select-none" aria-hidden="true">
            🏜️
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold">River not found</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              This river doesn&apos;t exist or may have been removed.
            </p>
          </div>

          <Link href="/rivers">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" />
              Back to Rivers
            </Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
