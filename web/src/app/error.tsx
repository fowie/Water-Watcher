"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <main className="flex items-center justify-center min-h-[80vh] p-4">
      <Card className="max-w-lg w-full text-center">
        <CardContent className="p-8 md:p-12 space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-red-100 p-4">
              <AlertTriangle className="h-10 w-10 text-red-600" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold">Something went wrong</h1>
            <p className="text-[var(--muted-foreground)] text-sm md:text-base max-w-sm mx-auto">
              We hit some unexpected rapids. Please try again or head back to the dashboard.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button onClick={reset} variant="default">
              <RotateCcw className="h-4 w-4" />
              Try Again
            </Button>
            <Link href="/">
              <Button variant="outline">
                <Home className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
