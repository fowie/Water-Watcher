/**
 * Tests for the Alert History API.
 *
 * Route: GET /api/alerts
 * Returns paginated alert logs for the authenticated user.
 *
 * Coverage:
 * - Returns paginated alerts with total
 * - Filters by type parameter
 * - Handles empty results
 * - Pagination params (limit, offset)
 * - Limit clamped to [1, 100]
 * - Auth required (401 without session)
 * - Database error handling
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  alertLog: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

const mockAuth = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

import { GET } from "@/app/api/alerts/route";

function mockRequest(url: string): Request {
  return new Request(url);
}

const SAMPLE_ALERTS = [
  {
    id: "alert-1",
    userId: "user-1",
    type: "deal",
    channel: "push",
    title: "New raft deal found",
    body: "NRS Otter 130 for $2500",
    metadata: { dealIds: ["deal-1"] },
    sentAt: "2026-02-24T10:00:00.000Z",
    createdAt: "2026-02-24T10:00:00.000Z",
  },
  {
    id: "alert-2",
    userId: "user-1",
    type: "condition",
    channel: "email",
    title: "Green River conditions improved",
    body: "fair → good",
    metadata: { riverId: "river-1" },
    sentAt: "2026-02-24T09:00:00.000Z",
    createdAt: "2026-02-24T09:00:00.000Z",
  },
  {
    id: "alert-3",
    userId: "user-1",
    type: "hazard",
    channel: "push",
    title: "Hazard alert: Gauley River",
    body: "Strainer at mile 12",
    metadata: null,
    sentAt: "2026-02-24T08:00:00.000Z",
    createdAt: "2026-02-24T08:00:00.000Z",
  },
];

describe("GET /api/alerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1", email: "test@example.com" } });
  });

  // ─── Auth ─────────────────────────────────────────

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = mockRequest("http://localhost:3000/api/alerts");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Authentication required");
  });

  it("returns 401 when session has no user id", async () => {
    mockAuth.mockResolvedValue({ user: {} });
    const req = mockRequest("http://localhost:3000/api/alerts");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  // ─── Basic response ──────────────────────────────

  it("returns paginated alerts", async () => {
    mockPrisma.alertLog.findMany.mockResolvedValue(SAMPLE_ALERTS);
    mockPrisma.alertLog.count.mockResolvedValue(3);

    const req = mockRequest("http://localhost:3000/api/alerts");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.alerts).toHaveLength(3);
    expect(data.total).toBe(3);
    expect(data.limit).toBe(20); // default
    expect(data.offset).toBe(0); // default
  });

  it("returns correct response shape", async () => {
    mockPrisma.alertLog.findMany.mockResolvedValue([SAMPLE_ALERTS[0]]);
    mockPrisma.alertLog.count.mockResolvedValue(1);

    const req = mockRequest("http://localhost:3000/api/alerts");
    const res = await GET(req);
    const data = await res.json();

    expect(data).toHaveProperty("alerts");
    expect(data).toHaveProperty("total");
    expect(data).toHaveProperty("limit");
    expect(data).toHaveProperty("offset");
  });

  // ─── Empty results ───────────────────────────────

  it("handles empty results", async () => {
    mockPrisma.alertLog.findMany.mockResolvedValue([]);
    mockPrisma.alertLog.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost:3000/api/alerts");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.alerts).toEqual([]);
    expect(data.total).toBe(0);
  });

  // ─── Type filter ─────────────────────────────────

  it("filters by type=deal", async () => {
    const dealAlerts = [SAMPLE_ALERTS[0]];
    mockPrisma.alertLog.findMany.mockResolvedValue(dealAlerts);
    mockPrisma.alertLog.count.mockResolvedValue(1);

    const req = mockRequest("http://localhost:3000/api/alerts?type=deal");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.alerts).toHaveLength(1);
    expect(mockPrisma.alertLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", type: "deal" },
      })
    );
  });

  it("filters by type=condition", async () => {
    mockPrisma.alertLog.findMany.mockResolvedValue([SAMPLE_ALERTS[1]]);
    mockPrisma.alertLog.count.mockResolvedValue(1);

    const req = mockRequest("http://localhost:3000/api/alerts?type=condition");
    await GET(req);

    expect(mockPrisma.alertLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", type: "condition" },
      })
    );
  });

  it("filters by type=hazard", async () => {
    mockPrisma.alertLog.findMany.mockResolvedValue([SAMPLE_ALERTS[2]]);
    mockPrisma.alertLog.count.mockResolvedValue(1);

    const req = mockRequest("http://localhost:3000/api/alerts?type=hazard");
    await GET(req);

    expect(mockPrisma.alertLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", type: "hazard" },
      })
    );
  });

  it("no type filter returns all alerts", async () => {
    mockPrisma.alertLog.findMany.mockResolvedValue(SAMPLE_ALERTS);
    mockPrisma.alertLog.count.mockResolvedValue(3);

    const req = mockRequest("http://localhost:3000/api/alerts");
    await GET(req);

    expect(mockPrisma.alertLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
      })
    );
  });

  // ─── Pagination ───────────────────────────────────

  it("respects custom limit", async () => {
    mockPrisma.alertLog.findMany.mockResolvedValue([SAMPLE_ALERTS[0]]);
    mockPrisma.alertLog.count.mockResolvedValue(3);

    const req = mockRequest("http://localhost:3000/api/alerts?limit=1");
    const res = await GET(req);
    const data = await res.json();

    expect(data.limit).toBe(1);
    expect(mockPrisma.alertLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 })
    );
  });

  it("respects custom offset", async () => {
    mockPrisma.alertLog.findMany.mockResolvedValue([SAMPLE_ALERTS[2]]);
    mockPrisma.alertLog.count.mockResolvedValue(3);

    const req = mockRequest("http://localhost:3000/api/alerts?offset=2");
    const res = await GET(req);
    const data = await res.json();

    expect(data.offset).toBe(2);
    expect(mockPrisma.alertLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 2 })
    );
  });

  it("clamps limit to max 100", async () => {
    mockPrisma.alertLog.findMany.mockResolvedValue([]);
    mockPrisma.alertLog.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost:3000/api/alerts?limit=500");
    const res = await GET(req);
    const data = await res.json();

    expect(data.limit).toBe(100);
    expect(mockPrisma.alertLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    );
  });

  it("clamps limit=0 to 1 (minimum clamp)", async () => {
    mockPrisma.alertLog.findMany.mockResolvedValue([]);
    mockPrisma.alertLog.count.mockResolvedValue(0);

    // parseInt("0") is 0, Number.isFinite(0) is true, Math.max(0, 1) = 1
    const req = mockRequest("http://localhost:3000/api/alerts?limit=0");
    const res = await GET(req);
    const data = await res.json();

    expect(data.limit).toBe(1);
  });

  it("clamps negative limit to 1", async () => {
    mockPrisma.alertLog.findMany.mockResolvedValue([]);
    mockPrisma.alertLog.count.mockResolvedValue(0);

    // parseInt("-5") is -5 (truthy), Math.max(-5, 1) = 1
    const req = mockRequest("http://localhost:3000/api/alerts?limit=-5");
    const res = await GET(req);
    const data = await res.json();

    expect(data.limit).toBe(1);
  });

  it("clamps negative offset to 0", async () => {
    mockPrisma.alertLog.findMany.mockResolvedValue([]);
    mockPrisma.alertLog.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost:3000/api/alerts?offset=-5");
    const res = await GET(req);
    const data = await res.json();

    expect(data.offset).toBe(0);
  });

  it("uses default limit=20 when not specified", async () => {
    mockPrisma.alertLog.findMany.mockResolvedValue([]);
    mockPrisma.alertLog.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost:3000/api/alerts");
    const res = await GET(req);
    const data = await res.json();

    expect(data.limit).toBe(20);
  });

  it("handles non-numeric limit gracefully", async () => {
    mockPrisma.alertLog.findMany.mockResolvedValue([]);
    mockPrisma.alertLog.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost:3000/api/alerts?limit=abc");
    const res = await GET(req);
    const data = await res.json();

    // NaN || 20 = 20
    expect(data.limit).toBe(20);
  });

  it("handles non-numeric offset gracefully", async () => {
    mockPrisma.alertLog.findMany.mockResolvedValue([]);
    mockPrisma.alertLog.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost:3000/api/alerts?offset=xyz");
    const res = await GET(req);
    const data = await res.json();

    expect(data.offset).toBe(0);
  });

  // ─── Ordering ─────────────────────────────────────

  it("orders by sentAt descending", async () => {
    mockPrisma.alertLog.findMany.mockResolvedValue(SAMPLE_ALERTS);
    mockPrisma.alertLog.count.mockResolvedValue(3);

    const req = mockRequest("http://localhost:3000/api/alerts");
    await GET(req);

    expect(mockPrisma.alertLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { sentAt: "desc" },
      })
    );
  });

  // ─── Error handling ───────────────────────────────

  it("returns 500 on database error", async () => {
    mockPrisma.alertLog.findMany.mockRejectedValue(new Error("Connection refused"));
    mockPrisma.alertLog.count.mockRejectedValue(new Error("Connection refused"));

    const req = mockRequest("http://localhost:3000/api/alerts");
    const res = await GET(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal server error");
  });

  // ─── Combined params ─────────────────────────────

  it("combines type filter with pagination", async () => {
    mockPrisma.alertLog.findMany.mockResolvedValue([]);
    mockPrisma.alertLog.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost:3000/api/alerts?type=digest&limit=5&offset=10");
    const res = await GET(req);
    const data = await res.json();

    expect(data.limit).toBe(5);
    expect(data.offset).toBe(10);
    expect(mockPrisma.alertLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", type: "digest" },
        take: 5,
        skip: 10,
      })
    );
  });

  it("count uses same where clause as findMany", async () => {
    mockPrisma.alertLog.findMany.mockResolvedValue([]);
    mockPrisma.alertLog.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost:3000/api/alerts?type=deal");
    await GET(req);

    expect(mockPrisma.alertLog.count).toHaveBeenCalledWith({
      where: { userId: "user-1", type: "deal" },
    });
  });
});
