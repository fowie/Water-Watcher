"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle,
  WifiOff,
  ServerCrash,
  ShieldAlert,
  SearchX,
  RotateCcw,
  Home,
  ExternalLink,
} from "lucide-react";

type ErrorVariant = "not-found" | "server-error" | "network-error" | "auth-error";

interface ErrorFallbackProps {
  variant?: ErrorVariant;
  title?: string;
  description?: string;
  onRetry?: () => void;
  showHomeLink?: boolean;
  showReportLink?: boolean;
  reportUrl?: string;
}

const variantConfig: Record<
  ErrorVariant,
  {
    icon: React.ReactNode;
    iconBg: string;
    defaultTitle: string;
    defaultDescription: string;
  }
> = {
  "not-found": {
    icon: <SearchX className="h-10 w-10 text-blue-600" />,
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    defaultTitle: "Not Found",
    defaultDescription: "The page or resource you're looking for doesn't exist or has been moved.",
  },
  "server-error": {
    icon: <ServerCrash className="h-10 w-10 text-red-600" />,
    iconBg: "bg-red-100 dark:bg-red-900/30",
    defaultTitle: "Server Error",
    defaultDescription: "Something went wrong on our end. Please try again in a moment.",
  },
  "network-error": {
    icon: <WifiOff className="h-10 w-10 text-orange-600" />,
    iconBg: "bg-orange-100 dark:bg-orange-900/30",
    defaultTitle: "Network Error",
    defaultDescription: "Unable to connect. Check your internet connection and try again.",
  },
  "auth-error": {
    icon: <ShieldAlert className="h-10 w-10 text-yellow-600" />,
    iconBg: "bg-yellow-100 dark:bg-yellow-900/30",
    defaultTitle: "Authentication Required",
    defaultDescription: "You need to sign in to access this page.",
  },
};

export function ErrorFallback({
  variant = "server-error",
  title,
  description,
  onRetry,
  showHomeLink = true,
  showReportLink = false,
  reportUrl,
}: ErrorFallbackProps) {
  const config = variantConfig[variant];
  const displayTitle = title ?? config.defaultTitle;
  const displayDescription = description ?? config.defaultDescription;
  const issueUrl =
    reportUrl ?? "https://github.com/Water-Watcher/Water-Watcher/issues/new";

  return (
    <main className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="max-w-lg w-full text-center">
        <CardContent className="p-8 md:p-12 space-y-6">
          <div className="flex justify-center">
            <div className={`rounded-full p-4 ${config.iconBg}`}>
              {config.icon}
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold">{displayTitle}</h1>
            <p className="text-[var(--muted-foreground)] text-sm md:text-base max-w-sm mx-auto">
              {displayDescription}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {onRetry && (
              <Button onClick={onRetry} variant="default">
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Try Again
              </Button>
            )}

            {variant === "auth-error" && (
              <Link href="/auth/signin">
                <Button variant="default">Sign In</Button>
              </Link>
            )}

            {showHomeLink && (
              <Link href="/">
                <Button variant="outline">
                  <Home className="h-4 w-4" aria-hidden="true" />
                  Go Home
                </Button>
              </Link>
            )}

            {showReportLink && (
              <a
                href={issueUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="ghost" className="text-[var(--muted-foreground)]">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Report Issue
                </Button>
              </a>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
