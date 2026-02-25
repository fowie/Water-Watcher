/**
 * Tests for the Notification Preferences API.
 *
 * Route: /api/user/notifications
 * Methods: GET, PATCH
 *
 * Coverage:
 * - GET returns default preferences when none exist
 * - GET returns existing preferences
 * - PATCH updates specific fields
 * - PATCH validates channel values ("push", "email", "both")
 * - PATCH validates boolean fields
 * - PATCH rejects empty update body
 * - Both require auth (401 without session)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  notificationPreference: {
    findUnique: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
  },
}));

const mockAuth = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

import { GET, PATCH } from "@/app/api/user/notifications/route";

function mockRequest(url: string, options: RequestInit = {}): Request {
  return new Request(url, options);
}

const DEFAULT_PREFS = {
  id: "pref-1",
  userId: "user-1",
  channel: "push",
  dealAlerts: true,
  conditionAlerts: true,
  hazardAlerts: true,
  weeklyDigest: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe("GET /api/user/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1", email: "test@example.com" } });
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = mockRequest("http://localhost:3000/api/user/notifications");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Authentication required");
  });

  it("returns 401 when session has no user id", async () => {
    mockAuth.mockResolvedValue({ user: {} });
    const req = mockRequest("http://localhost:3000/api/user/notifications");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns default preferences when none exist", async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(null);
    mockPrisma.notificationPreference.create.mockResolvedValue(DEFAULT_PREFS);

    const req = mockRequest("http://localhost:3000/api/user/notifications");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.channel).toBe("push");
    expect(data.dealAlerts).toBe(true);
    expect(data.conditionAlerts).toBe(true);
    expect(data.hazardAlerts).toBe(true);
    expect(data.weeklyDigest).toBe(false);
    // Should have called create to persist defaults
    expect(mockPrisma.notificationPreference.create).toHaveBeenCalled();
  });

  it("returns existing preferences", async () => {
    const existing = { ...DEFAULT_PREFS, channel: "email", weeklyDigest: true };
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(existing);

    const req = mockRequest("http://localhost:3000/api/user/notifications");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.channel).toBe("email");
    expect(data.weeklyDigest).toBe(true);
    expect(mockPrisma.notificationPreference.create).not.toHaveBeenCalled();
  });

  it("returns 500 on database error", async () => {
    mockPrisma.notificationPreference.findUnique.mockRejectedValue(new Error("DB down"));

    const req = mockRequest("http://localhost:3000/api/user/notifications");
    const res = await GET(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("Internal server error");
  });

  it("queries with the authenticated user's id", async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(DEFAULT_PREFS);

    const req = mockRequest("http://localhost:3000/api/user/notifications");
    await GET(req);

    expect(mockPrisma.notificationPreference.findUnique).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
  });
});

describe("PATCH /api/user/notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1", email: "test@example.com" } });
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const req = mockRequest("http://localhost:3000/api/user/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "email" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it("updates channel to email", async () => {
    const updated = { ...DEFAULT_PREFS, channel: "email" };
    mockPrisma.notificationPreference.upsert.mockResolvedValue(updated);

    const req = mockRequest("http://localhost:3000/api/user/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "email" }),
    });
    const res = await PATCH(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.channel).toBe("email");
  });

  it("updates channel to both", async () => {
    const updated = { ...DEFAULT_PREFS, channel: "both" };
    mockPrisma.notificationPreference.upsert.mockResolvedValue(updated);

    const req = mockRequest("http://localhost:3000/api/user/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "both" }),
    });
    const res = await PATCH(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.channel).toBe("both");
  });

  it("rejects invalid channel value", async () => {
    const req = mockRequest("http://localhost:3000/api/user/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "sms" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid channel");
  });

  it("rejects empty string channel", async () => {
    const req = mockRequest("http://localhost:3000/api/user/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("updates boolean fields", async () => {
    const updated = { ...DEFAULT_PREFS, dealAlerts: false, weeklyDigest: true };
    mockPrisma.notificationPreference.upsert.mockResolvedValue(updated);

    const req = mockRequest("http://localhost:3000/api/user/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealAlerts: false, weeklyDigest: true }),
    });
    const res = await PATCH(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.dealAlerts).toBe(false);
    expect(data.weeklyDigest).toBe(true);
  });

  it("rejects non-boolean dealAlerts", async () => {
    const req = mockRequest("http://localhost:3000/api/user/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealAlerts: "yes" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("dealAlerts");
    expect(data.error).toContain("boolean");
  });

  it("rejects non-boolean conditionAlerts", async () => {
    const req = mockRequest("http://localhost:3000/api/user/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conditionAlerts: 1 }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("rejects empty body (no valid fields)", async () => {
    const req = mockRequest("http://localhost:3000/api/user/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("No valid fields");
  });

  it("ignores unknown fields", async () => {
    const updated = { ...DEFAULT_PREFS };
    mockPrisma.notificationPreference.upsert.mockResolvedValue(updated);

    const req = mockRequest("http://localhost:3000/api/user/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unknownField: "value", dealAlerts: true }),
    });
    const res = await PATCH(req);
    // Should succeed — unknownField is ignored, dealAlerts is valid
    expect(res.status).toBe(200);
  });

  it("only unknown fields → 400 no valid fields", async () => {
    const req = mockRequest("http://localhost:3000/api/user/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ foo: "bar", baz: 42 }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("uses upsert to handle first-time PATCH", async () => {
    const created = { ...DEFAULT_PREFS, channel: "email" };
    mockPrisma.notificationPreference.upsert.mockResolvedValue(created);

    const req = mockRequest("http://localhost:3000/api/user/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "email" }),
    });
    await PATCH(req);

    expect(mockPrisma.notificationPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        create: expect.objectContaining({ userId: "user-1", channel: "email" }),
        update: expect.objectContaining({ channel: "email" }),
      })
    );
  });

  it("returns 500 on database error", async () => {
    mockPrisma.notificationPreference.upsert.mockRejectedValue(new Error("DB down"));

    const req = mockRequest("http://localhost:3000/api/user/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: "push" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(500);
  });

  it("updates single field without touching others", async () => {
    const updated = { ...DEFAULT_PREFS, hazardAlerts: false };
    mockPrisma.notificationPreference.upsert.mockResolvedValue(updated);

    const req = mockRequest("http://localhost:3000/api/user/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hazardAlerts: false }),
    });
    await PATCH(req);

    const upsertCall = mockPrisma.notificationPreference.upsert.mock.calls[0][0];
    expect(upsertCall.update).toEqual({ hazardAlerts: false });
  });
});
