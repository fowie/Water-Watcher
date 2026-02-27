"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils";

export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";
export type AlertType = "closure" | "permit" | "high_water" | "low_water" | "hazard" | "weather";

export interface SafetyAlert {
  id: string;
  riverId: string;
  severity: AlertSeverity;
  type: AlertType;
  title: string;
  message: string;
  createdAt: string;
  expiresAt: string | null;
}

const SEVERITY_STYLES: Record<AlertSeverity, { bg: string; border: string; text: string; badge: string }> = {
  INFO: {
    bg: "bg-blue-50 dark:bg-blue-950",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-800 dark:text-blue-200",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  WARNING: {
    bg: "bg-amber-50 dark:bg-amber-950",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-800 dark:text-amber-200",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  CRITICAL: {
    bg: "bg-red-50 dark:bg-red-950",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-800 dark:text-red-200",
    badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
};

const ALERT_TYPE_ICONS: Record<AlertType, string> = {
  closure: "🚧",
  permit: "📋",
  high_water: "🌊",
  low_water: "💧",
  hazard: "⚠️",
  weather: "🌩️",
};

interface SafetyAlertBannerProps {
  riverId: string;
}

export function SafetyAlertBanner({ riverId }: SafetyAlertBannerProps) {
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch(`/api/rivers/${riverId}/safety-alerts`);
      if (!res.ok) {
        setAlerts([]);
        return;
      }
      const data = await res.json();
      setAlerts(data.alerts ?? []);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [riverId]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleDismiss = async (alertId: string) => {
    setDismissed((prev) => new Set(prev).add(alertId));
    try {
      await fetch(`/api/rivers/${riverId}/safety-alerts/${alertId}/acknowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // Silently fail — alert is dismissed locally regardless
    }
  };

  const visibleAlerts = alerts.filter((a) => !dismissed.has(a.id));

  if (loading || visibleAlerts.length === 0) return null;

  const displayedAlerts = expanded ? visibleAlerts : visibleAlerts.slice(0, 2);
  const hiddenCount = visibleAlerts.length - 2;

  return (
    <div className="space-y-2" role="region" aria-label="Safety alerts">
      {displayedAlerts.map((alert) => {
        const styles = SEVERITY_STYLES[alert.severity];
        const icon = ALERT_TYPE_ICONS[alert.type] ?? "⚠️";

        return (
          <div
            key={alert.id}
            className={cn(
              "rounded-lg border px-4 py-3 flex items-start gap-3",
              styles.bg,
              styles.border
            )}
            role="alert"
          >
            <span className="text-lg shrink-0 mt-0.5" aria-hidden="true">
              {icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("font-semibold text-sm", styles.text)}>
                  {alert.title}
                </span>
                <Badge variant="secondary" className={cn("text-[10px]", styles.badge)}>
                  {alert.severity}
                </Badge>
              </div>
              <p className={cn("text-sm mt-1", styles.text, "opacity-80")}>
                {alert.message}
              </p>
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                {timeAgo(alert.createdAt)}
              </p>
            </div>
            <button
              onClick={() => handleDismiss(alert.id)}
              className={cn(
                "shrink-0 p-1 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 transition-colors",
                styles.text
              )}
              aria-label={`Dismiss ${alert.title}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}

      {visibleAlerts.length > 2 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="w-full text-xs text-[var(--muted-foreground)]"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3 mr-1" aria-hidden="true" />
              Show fewer alerts
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 mr-1" aria-hidden="true" />
              Show {hiddenCount} more alert{hiddenCount !== 1 ? "s" : ""}
            </>
          )}
        </Button>
      )}
    </div>
  );
}
