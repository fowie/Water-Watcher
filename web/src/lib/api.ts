import type {
  RiverSummary,
  RiverDetail,
  GearDealRecord,
  DealFilterRecord,
} from "@/types";
import type { RiverInput, DealFilterInput } from "@/lib/validations";

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

export async function getRivers(params?: {
  search?: string;
  state?: string;
}): Promise<RiverSummary[]> {
  const sp = new URLSearchParams();
  if (params?.search) sp.set("search", params.search);
  if (params?.state) sp.set("state", params.state);
  const q = sp.toString();
  const raw = await fetcher<Record<string, unknown>[]>(
    `/api/rivers${q ? `?${q}` : ""}`
  );
  return raw.map(mapRiverSummary);
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
