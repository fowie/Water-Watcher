"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/error-fallback";

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
    <ErrorFallback
      variant="server-error"
      title="Couldn't load river"
      description="Something went wrong loading this river's data. It might be a temporary issue."
      onRetry={reset}
      showHomeLink
    />
  );
}
