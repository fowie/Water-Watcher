import type {
  RiverSummary,
  RiverDetail,
  GearDealRecord,
  DealFilterRecord,
} from "@/types";
import type {
  RiverInput,
  RiverUpdateInput,
  DealFilterInput,
  DealFilterUpdateInput,
  TripInput,
  TripUpdateInput,
  TripStopInput,
  ReviewInput,
  PhotoInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from "@/lib/validations";

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

// ─── User Profile ───────────────────────────────────────

export interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  createdAt: string;
  riverCount: number;
  filterCount: number;
}

export async function getUserProfile(): Promise<UserProfile> {
  return fetcher<UserProfile>("/api/user/profile");
}

export async function updateUserProfile(data: {
  name?: string;
  email?: string;
}): Promise<UserProfile> {
  return fetcher<UserProfile>("/api/user/profile", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ─── Tracked Rivers (Favorites) ─────────────────────────

export interface TrackedRiver extends RiverSummary {
  trackedAt: string;
}

export interface TrackedRiversResponse {
  rivers: TrackedRiver[];
}

export async function getTrackedRivers(): Promise<TrackedRiversResponse> {
  return fetcher<TrackedRiversResponse>("/api/user/rivers");
}

export async function trackRiver(riverId: string): Promise<{ id: string; riverId: string }> {
  return fetcher<{ id: string; riverId: string }>("/api/user/rivers", {
    method: "POST",
    body: JSON.stringify({ riverId }),
  });
}

export async function untrackRiver(riverId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/user/rivers?riverId=${encodeURIComponent(riverId)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to untrack: ${res.status}`);
  }
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

// ─── Notification Preferences ───────────────────────────

export interface NotificationPreferences {
  id: string;
  userId: string;
  channel: "push" | "email" | "both";
  dealAlerts: boolean;
  conditionAlerts: boolean;
  hazardAlerts: boolean;
  weeklyDigest: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  return fetcher<NotificationPreferences>("/api/user/notifications");
}

export async function updateNotificationPreferences(
  data: Partial<Omit<NotificationPreferences, "id" | "userId" | "createdAt" | "updatedAt">>
): Promise<NotificationPreferences> {
  return fetcher<NotificationPreferences>("/api/user/notifications", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// ─── Alert History ──────────────────────────────────────

export interface AlertLogRecord {
  id: string;
  type: "deal" | "condition" | "hazard" | "digest";
  channel: "push" | "email";
  title: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
  sentAt: string;
  createdAt: string;
}

export interface AlertsResponse {
  alerts: AlertLogRecord[];
  total: number;
  limit: number;
  offset: number;
}

export async function getAlerts(params?: {
  type?: string;
  limit?: number;
  offset?: number;
}): Promise<AlertsResponse> {
  const sp = new URLSearchParams();
  if (params?.type) sp.set("type", params.type);
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.offset) sp.set("offset", String(params.offset));
  const q = sp.toString();
  return fetcher<AlertsResponse>(`/api/alerts${q ? `?${q}` : ""}`);
}

// ─── Data Export ────────────────────────────────────────

export async function exportData(
  format: "json" | "csv" | "gpx",
  type: "rivers" | "conditions" | "deals" | "all"
): Promise<Blob> {
  const res = await fetch(`${BASE}/api/export?format=${format}&type=${type}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Export failed: ${res.status}`);
  }
  return res.blob();
}

// ─── Trips ──────────────────────────────────────────────

export interface TripRecord {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "planning" | "active" | "completed" | "cancelled";
  notes: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  stops: TripStopRecord[];
  _count?: { stops: number };
}

export interface TripStopRecord {
  id: string;
  tripId: string;
  riverId: string;
  dayNumber: number;
  notes: string | null;
  putInTime: string | null;
  takeOutTime: string | null;
  sortOrder: number;
  createdAt: string;
  river: {
    id: string;
    name: string;
    state: string;
    difficulty: string | null;
  };
}

export interface TripsResponse {
  trips: TripRecord[];
}

export async function getTrips(params?: {
  status?: string;
  upcoming?: boolean;
}): Promise<TripsResponse> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.upcoming) sp.set("upcoming", "true");
  const q = sp.toString();
  return fetcher<TripsResponse>(`/api/trips${q ? `?${q}` : ""}`);
}

export async function createTrip(data: TripInput): Promise<TripRecord> {
  return fetcher<TripRecord>("/api/trips", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getTrip(id: string): Promise<TripRecord> {
  return fetcher<TripRecord>(`/api/trips/${id}`);
}

export async function updateTrip(
  id: string,
  data: TripUpdateInput
): Promise<TripRecord> {
  return fetcher<TripRecord>(`/api/trips/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteTrip(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/trips/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Delete failed: ${res.status}`);
  }
}

export async function addTripStop(
  tripId: string,
  data: TripStopInput
): Promise<TripStopRecord> {
  return fetcher<TripStopRecord>(`/api/trips/${tripId}/stops`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function removeTripStop(
  tripId: string,
  stopId: string
): Promise<void> {
  const res = await fetch(`${BASE}/api/trips/${tripId}/stops/${stopId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Delete failed: ${res.status}`);
  }
}

// ─── River Reviews ──────────────────────────────────────

export interface ReviewRecord {
  id: string;
  riverId: string;
  userId: string;
  rating: number;
  title: string | null;
  body: string;
  visitDate: string | null;
  difficulty: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

export interface ReviewsResponse {
  reviews: ReviewRecord[];
  total: number;
  limit: number;
  offset: number;
  averageRating: number | null;
}

export async function getRiverReviews(
  riverId: string,
  params?: { limit?: number; offset?: number }
): Promise<ReviewsResponse> {
  const sp = new URLSearchParams();
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.offset) sp.set("offset", String(params.offset));
  const q = sp.toString();
  return fetcher<ReviewsResponse>(
    `/api/rivers/${riverId}/reviews${q ? `?${q}` : ""}`
  );
}

export async function submitReview(
  riverId: string,
  data: ReviewInput
): Promise<ReviewRecord> {
  return fetcher<ReviewRecord>(`/api/rivers/${riverId}/reviews`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ─── Helpers ────────────────────────────────────────────

// ─── Global Search ──────────────────────────────────────

export interface SearchResultItem {
  type: "river" | "deal" | "trip" | "review";
  id: string;
  title: string;
  subtitle: string;
  url: string;
}

export interface SearchResponse {
  rivers: SearchResultItem[];
  deals: SearchResultItem[];
  trips: SearchResultItem[];
  reviews: SearchResultItem[];
  totalResults: number;
}

export async function search(params: {
  q: string;
  type?: "rivers" | "deals" | "trips" | "reviews" | "all";
  limit?: number;
}): Promise<SearchResponse> {
  const sp = new URLSearchParams();
  sp.set("q", params.q);
  if (params.type) sp.set("type", params.type);
  if (params.limit) sp.set("limit", String(params.limit));
  return fetcher<SearchResponse>(`/api/search?${sp.toString()}`);
}

// ─── River Photos ───────────────────────────────────────

export interface RiverPhotoRecord {
  id: string;
  riverId: string;
  userId: string;
  url: string;
  caption: string | null;
  takenAt: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

export interface RiverPhotosResponse {
  photos: RiverPhotoRecord[];
  total: number;
  limit: number;
  offset: number;
}

export async function getRiverPhotos(
  riverId: string,
  params?: { limit?: number; offset?: number }
): Promise<RiverPhotosResponse> {
  const sp = new URLSearchParams();
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.offset) sp.set("offset", String(params.offset));
  const q = sp.toString();
  return fetcher<RiverPhotosResponse>(
    `/api/rivers/${riverId}/photos${q ? `?${q}` : ""}`
  );
}

export async function uploadRiverPhoto(
  riverId: string,
  data: PhotoInput
): Promise<RiverPhotoRecord> {
  return fetcher<RiverPhotoRecord>(`/api/rivers/${riverId}/photos`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteRiverPhoto(
  riverId: string,
  photoId: string
): Promise<void> {
  const res = await fetch(`${BASE}/api/rivers/${riverId}/photos/${photoId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok && res.status !== 204) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Delete failed: ${res.status}`);
  }
}

// ─── Scraper Monitoring ─────────────────────────────────

export interface ScraperStat {
  source: string;
  lastScrapeAt: string | null;
  lastStatus: string | null;
  totalScrapes24h: number;
  successCount24h: number;
  itemsScraped24h: number;
  avgDurationMs: number | null;
}

export interface ScraperStatsResponse {
  scrapers: ScraperStat[];
  summary: {
    totalRiversTracked: number;
    conditionsLast24h: number;
    activeHazards: number;
  };
}

export async function getScraperStats(): Promise<ScraperStatsResponse> {
  return fetcher<ScraperStatsResponse>("/api/admin/scrapers");
}

export interface ScraperLogEntry {
  id: string;
  status: string;
  itemCount: number;
  error: string | null;
  duration: number | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface ScraperDetailResponse {
  source: string;
  logs: ScraperLogEntry[];
  stats: {
    totalScrapes: number;
    successRate: number;
    avgItemsPerRun: number;
    totalItems: number;
    avgDurationMs: number | null;
  };
}

export async function getScraperDetail(source: string): Promise<ScraperDetailResponse> {
  return fetcher<ScraperDetailResponse>(`/api/admin/scrapers/${source}`);
}

// ─── Admin: User Management ────────────────────────────

export interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: string;
  trackedRiverCount: number;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  limit: number;
  offset: number;
}

export async function getAdminUsers(params?: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminUsersResponse> {
  const sp = new URLSearchParams();
  if (params?.search) sp.set("search", params.search);
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.offset) sp.set("offset", String(params.offset));
  const q = sp.toString();
  return fetcher<AdminUsersResponse>(`/api/admin/users${q ? `?${q}` : ""}`);
}

export async function updateAdminUserRole(userId: string, role: string): Promise<AdminUser> {
  return fetcher<AdminUser>(`/api/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

// ─── Helpers ────────────────────────────────────────────

// ─── Auth: Password Reset ───────────────────────────────

export async function forgotPassword(email: string): Promise<{ message: string }> {
  return fetcher<{ message: string }>("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ message: string }> {
  return fetcher<{ message: string }>("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  });
}

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
