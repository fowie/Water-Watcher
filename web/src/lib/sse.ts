"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Types ──────────────────────────────────────────────

export interface ConditionUpdateEvent {
  id: string;
  riverId: string;
  riverName: string;
  state: string;
  flowRate: number | null;
  gaugeHeight: number | null;
  waterTemp: number | null;
  quality: string | null;
  runnability: string | null;
  source: string;
  scrapedAt: string;
}

export interface HazardAlertEvent {
  id: string;
  riverId: string;
  riverName: string;
  type: string;
  severity: string;
  title: string;
  description: string | null;
  reportedAt: string;
}

export interface DealMatchEvent {
  matchId: string;
  dealId: string;
  dealTitle: string;
  dealPrice: number | null;
  dealUrl: string;
  category: string | null;
  filterId: string;
  filterName: string;
  userId: string;
  matchedAt: string;
}

export type SSEEventHandlers = {
  onConditionUpdate?: (data: ConditionUpdateEvent) => void;
  onHazardAlert?: (data: HazardAlertEvent) => void;
  onDealMatch?: (data: DealMatchEvent) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
};

// ─── SSE Client Factory ─────────────────────────────────

/**
 * Creates an EventSource wrapper with typed event handlers.
 * Returns a cleanup function to close the connection.
 */
export function createSSEClient(
  url: string,
  handlers: SSEEventHandlers = {}
): () => void {
  const eventSource = new EventSource(url);

  if (handlers.onOpen) {
    eventSource.addEventListener("open", handlers.onOpen);
  }

  if (handlers.onError) {
    eventSource.addEventListener("error", handlers.onError);
  }

  if (handlers.onConditionUpdate) {
    const handler = handlers.onConditionUpdate;
    eventSource.addEventListener("condition-update", (event) => {
      try {
        handler(JSON.parse((event as MessageEvent).data));
      } catch {
        // Ignore parse errors
      }
    });
  }

  if (handlers.onHazardAlert) {
    const handler = handlers.onHazardAlert;
    eventSource.addEventListener("hazard-alert", (event) => {
      try {
        handler(JSON.parse((event as MessageEvent).data));
      } catch {
        // Ignore parse errors
      }
    });
  }

  if (handlers.onDealMatch) {
    const handler = handlers.onDealMatch;
    eventSource.addEventListener("deal-match", (event) => {
      try {
        handler(JSON.parse((event as MessageEvent).data));
      } catch {
        // Ignore parse errors
      }
    });
  }

  return () => {
    eventSource.close();
  };
}

// ─── React Hook ─────────────────────────────────────────

interface UseRiverSSEOptions {
  riverId?: string;
  enabled?: boolean;
}

interface UseRiverSSEResult {
  conditions: ConditionUpdateEvent[];
  hazards: HazardAlertEvent[];
  deals: DealMatchEvent[];
  isConnected: boolean;
  error: boolean;
}

/**
 * React hook that subscribes to the SSE endpoint for live river updates.
 * Auto-reconnects with exponential backoff on connection failures.
 *
 * @param options.riverId — If provided, filters events to only this river.
 * @param options.enabled — Whether to connect (default: true).
 */
export function useRiverSSE(options: UseRiverSSEOptions = {}): UseRiverSSEResult {
  const { riverId, enabled = true } = options;

  const [conditions, setConditions] = useState<ConditionUpdateEvent[]>([]);
  const [hazards, setHazards] = useState<HazardAlertEvent[]>([]);
  const [deals, setDeals] = useState<DealMatchEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(false);

  const retriesRef = useRef(0);
  const cleanupRef = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    // Clean up previous connection
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    const url = "/api/sse/rivers";

    const cleanup = createSSEClient(url, {
      onOpen: () => {
        setIsConnected(true);
        setError(false);
        retriesRef.current = 0; // Reset backoff on successful connection
      },
      onConditionUpdate: (data) => {
        if (riverId && data.riverId !== riverId) return;
        setConditions((prev) => [data, ...prev].slice(0, 100));
      },
      onHazardAlert: (data) => {
        if (riverId && data.riverId !== riverId) return;
        setHazards((prev) => [data, ...prev].slice(0, 50));
      },
      onDealMatch: (data) => {
        // Deals are not river-scoped, always include
        setDeals((prev) => [data, ...prev].slice(0, 50));
      },
      onError: () => {
        setIsConnected(false);
        setError(true);

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s max
        const delay = Math.min(1000 * Math.pow(2, retriesRef.current), 30_000);
        retriesRef.current += 1;

        timeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      },
    });

    cleanupRef.current = cleanup;
  }, [riverId]);

  useEffect(() => {
    if (!enabled) return;

    connect();

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [enabled, connect]);

  return { conditions, hazards, deals, isConnected, error };
}
