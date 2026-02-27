"use client";

import { useState, useEffect, useCallback } from "react";
import { WifiOff, X } from "lucide-react";

export function NetworkStatus() {
  const [isOffline, setIsOffline] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const handleOnline = useCallback(() => {
    setIsOffline(false);
    setDismissed(false);
  }, []);

  const handleOffline = useCallback(() => {
    setIsOffline(true);
    setDismissed(false);
  }, []);

  useEffect(() => {
    // Check initial state
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOffline(true);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOnline, handleOffline]);

  if (!isOffline || dismissed) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[60] bg-orange-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow-md print:hidden"
      role="status"
      aria-live="assertive"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>You&apos;re offline — some features may be limited</span>
      <button
        onClick={() => setDismissed(true)}
        className="ml-2 p-1 rounded hover:bg-orange-600 transition-colors shrink-0"
        aria-label="Dismiss offline notification"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
