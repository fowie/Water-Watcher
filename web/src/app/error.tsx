"use client";

import { useEffect } from "react";
import { ErrorFallback } from "@/components/error-fallback";

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
    <ErrorFallback
      variant="server-error"
      title="Something went wrong"
      description="We hit some unexpected rapids. Please try again or head back to the dashboard."
      onRetry={reset}
      showHomeLink
      showReportLink
    />
  );
}
