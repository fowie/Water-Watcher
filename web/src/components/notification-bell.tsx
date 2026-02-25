"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { getAlerts } from "@/lib/api";
import type { AlertLogRecord } from "@/lib/api";

const typeIcons: Record<string, string> = {
  deal: "🏷️",
  condition: "🌊",
  hazard: "⚠️",
  digest: "📋",
};

export function NotificationBell() {
  const { status } = useSession();
  const [alerts, setAlerts] = useState<AlertLogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const data = await getAlerts({ limit: 5 });
      setAlerts(data.alerts);
      setTotal(data.total);
    } catch {
      // Silent fail — bell just shows 0
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchAlerts();
      // Poll every 60 seconds
      const interval = setInterval(fetchAlerts, 60_000);
      return () => clearInterval(interval);
    }
  }, [status, fetchAlerts]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (status !== "authenticated") return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-md hover:bg-[var(--secondary)] transition-colors"
        aria-label={`Notifications${total > 0 ? ` (${total} alerts)` : ""}`}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-4 min-w-[1rem] px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <div className={cn(
          "absolute z-50 mt-2 w-80 rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl",
          "right-0 md:right-auto md:left-0"
        )}>
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {total > 0 && (
              <span className="text-xs text-[var(--muted-foreground)]">{total} total</span>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">
              <Bell className="h-6 w-6 mx-auto mb-2 opacity-40" aria-hidden="true" />
              No notifications yet
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="px-4 py-3 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--secondary)]/50 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base mt-0.5 shrink-0" aria-hidden="true">
                      {typeIcons[alert.type] || "🔔"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{alert.title}</p>
                      {alert.body && (
                        <p className="text-xs text-[var(--muted-foreground)] line-clamp-2 mt-0.5">
                          {alert.body}
                        </p>
                      )}
                      <p className="text-[10px] text-[var(--muted-foreground)] mt-1">
                        {timeAgo(alert.sentAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="px-4 py-2.5 border-t border-[var(--border)]">
            <Link
              href="/alerts"
              onClick={() => setOpen(false)}
              className="block text-center text-sm text-[var(--primary)] hover:underline font-medium"
            >
              View All Alerts
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
