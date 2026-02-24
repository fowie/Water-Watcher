"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, RotateCcw, ArrowLeft } from "lucide-react";

export default function RiverDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("River detail error:", error);
  }, [error]);

  return (
    <main className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="max-w-md w-full text-center">
        <CardContent className="p-8 space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-red-100 p-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold">Couldn&apos;t load river</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Something went wrong loading this river&apos;s data. It might be a temporary issue.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button onClick={reset} variant="default" size="sm">
              <RotateCcw className="h-4 w-4" />
              Try Again
            </Button>
            <Link href="/rivers">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4" />
                Back to Rivers
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
