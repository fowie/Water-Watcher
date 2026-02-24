import type {
  RiverSummary,
  RiverDetail,
  GearDealRecord,
  DealFilterRecord,
} from "@/types";
import type { RiverInput, RiverUpdateInput, DealFilterInput, DealFilterUpdateInput } from "@/lib/validations";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

async function fetcher<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

// ─── Rivers ─────────────────────────────────────────────

export interface RiversResponse {
  rivers: RiverSummary[];
  total: number;
  limit: number;
  offset: number;
}

export async function getRivers(params?: {
  search?: string;
  state?: string;
  limit?: number;
  offset?: number;
}): Promise<RiversResponse> {
  const sp = new URLSearchParams();
  if (params?.search) sp.set("search", params.search);
  if (params?.state) sp.set("state", params.state);
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.offset) sp.set("offset", String(params.offset));
  const q = sp.toString();
  const data = await fetcher<{ rivers: Record<string, unknown>[]; total: number; limit: number; offset: number }>(
    `/api/rivers${q ? `?${q}` : ""}`
  );
  return {
    rivers: data.rivers.map(mapRiverSummary),
    total: data.total,
    limit: data.limit,
    offset: data.offset,
  };
}

export async function getRiver(id: string): Promise<RiverDetail> {
  return fetcher<RiverDetail>(`/api/rivers/${id}`);
}

export async function createRiver(data: RiverInput) {
  return fetcher<{ id: string }>("/api/rivers", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteRiver(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/rivers/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Delete failed: ${res.status}`);
  }
}

export async function updateRiver(id: string, data: RiverUpdateInput) {
  return fetcher<RiverDetail>(`/api/rivers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ─── Deals ──────────────────────────────────────────────

export interface DealsResponse {
  deals: GearDealRecord[];
  total: number;
  limit: number;
  offset: number;
}

export async function getDeals(params?: {
  category?: string;
  maxPrice?: number;
  region?: string;
  limit?: number;
  offset?: number;
}): Promise<DealsResponse> {
  const sp = new URLSearchParams();
  if (params?.category) sp.set("category", params.category);
  if (params?.maxPrice) sp.set("maxPrice", String(params.maxPrice));
  if (params?.region) sp.set("region", params.region);
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.offset) sp.set("offset", String(params.offset));
  const q = sp.toString();
  return fetcher<DealsResponse>(`/api/deals${q ? `?${q}` : ""}`);
}

// ─── Deal Filters ───────────────────────────────────────

export async function getDealFilters(
  userId: string
): Promise<DealFilterRecord[]> {
  return fetcher<DealFilterRecord[]>(
    `/api/deals/filters?userId=${encodeURIComponent(userId)}`
  );
}

export async function createDealFilter(
  userId: string,
  data: DealFilterInput
) {
  return fetcher<{ id: string }>("/api/deals/filters", {
    method: "POST",
    body: JSON.stringify({ userId, ...data }),
  });
}

export async function updateDealFilter(
  id: string,
  userId: string,
  data: DealFilterUpdateInput
) {
  return fetcher<DealFilterRecord>(`/api/deals/filters/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ userId, ...data }),
  });
}

// ─── Health ─────────────────────────────────────────────

export interface HealthResponse {
  status: "ok" | "degraded";
  timestamp: string;
  version: string;
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${BASE}/api/health`);
  return res.json();
}

// ─── Notifications ──────────────────────────────────────

export async function subscribePush(
  userId: string,
  subscription: PushSubscriptionJSON
) {
  return fetcher("/api/notifications/subscribe", {
    method: "POST",
    body: JSON.stringify({ userId, subscription }),
  });
}

// ─── Helpers ────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRiverSummary(r: any): RiverSummary {
  const latest = r.conditions?.[0] ?? null;
  return {
    id: r.id,
    name: r.name,
    state: r.state,
    difficulty: r.difficulty,
    latestCondition: latest
      ? {
          quality: latest.quality,
          flowRate: latest.flowRate ?? latest.flow_rate,
          runnability: latest.runnability,
          scrapedAt: latest.scrapedAt ?? latest.scraped_at,
        }
      : null,
    activeHazardCount: r.hazards?.length ?? 0,
    trackerCount: r._count?.trackedBy ?? 0,
  };
}
