"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

/**
 * A dismissable banner that appears when the app can be installed as a PWA.
 * Uses the `beforeinstallprompt` event to detect installability.
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Check if already dismissed in this session
    const wasDismissed = sessionStorage.getItem("pwa-install-dismissed");
    if (wasDismissed) {
      setDismissed(true);
    }

    // Check if already installed (standalone mode)
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone
    ) {
      setInstalled(true);
      return;
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
      }
    } catch {
      // Silently handle if prompt fails
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    sessionStorage.setItem("pwa-install-dismissed", "true");
  }, []);

  // Don't show if no prompt available, dismissed, or already installed
  if (!deferredPrompt || dismissed || installed) return null;

  return (
    <div
      className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 bg-[var(--background)] border border-[var(--border)] rounded-lg shadow-lg p-4 flex items-start gap-3 animate-[fadeIn_300ms_ease-out]"
      role="alert"
      aria-live="polite"
    >
      <div className="rounded-full bg-[var(--primary)]/10 p-2 shrink-0">
        <Download className="h-5 w-5 text-[var(--primary)]" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--foreground)]">
          Install Water Watcher
        </p>
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
          Add to your home screen for quick access and offline support.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Button
            size="sm"
            onClick={handleInstall}
            className="text-xs h-7"
            aria-label="Install Water Watcher as an app"
          >
            Install
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="text-xs h-7"
            aria-label="Dismiss install prompt"
          >
            Not now
          </Button>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        className="p-1 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] transition-colors shrink-0"
        aria-label="Close install prompt"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
