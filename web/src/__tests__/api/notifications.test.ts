/**
 * Tests for the Push Notification Subscribe API.
 *
 * Tests:
 * - POST /api/notifications/subscribe
 * - Validation of push subscription data
 * - Missing userId handling
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  pushSubscription: {
    upsert: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

import { POST } from "@/app/api/notifications/subscribe/route";

function mockRequest(url: string, options: RequestInit = {}): Request {
  return new Request(url, options);
}

describe("POST /api/notifications/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates subscription with valid data", async () => {
    const expectedSub = {
      id: "sub-1",
      userId: "user-1",
      endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
      p256dh: "BIG_KEY",
      auth: "AUTH_SECRET",
    };
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1" });
    mockPrisma.pushSubscription.upsert.mockResolvedValue(expectedSub);

    const req = mockRequest(
      "http://localhost:3000/api/notifications/subscribe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "user-1",
          subscription: {
            endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
            keys: {
              p256dh: "BIG_KEY",
              auth: "AUTH_SECRET",
            },
          },
        }),
      }
    );
    const res = await POST(req);

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.endpoint).toBe("https://fcm.googleapis.com/fcm/send/abc123");
  });

  it("returns 400 when userId is missing", async () => {
    const req = mockRequest(
      "http://localhost:3000/api/notifications/subscribe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: {
            endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
            keys: { p256dh: "key", auth: "auth" },
          },
        }),
      }
    );
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("userId is required");
  });

  it("returns 400 for invalid subscription (missing endpoint)", async () => {
    const req = mockRequest(
      "http://localhost:3000/api/notifications/subscribe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "user-1",
          subscription: {
            keys: { p256dh: "key", auth: "auth" },
          },
        }),
      }
    );
    const res = await POST(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid subscription");
  });

  it("returns 400 for non-URL endpoint", async () => {
    const req = mockRequest(
      "http://localhost:3000/api/notifications/subscribe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "user-1",
          subscription: {
            endpoint: "not-a-url",
            keys: { p256dh: "key", auth: "auth" },
          },
        }),
      }
    );
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 for missing keys", async () => {
    const req = mockRequest(
      "http://localhost:3000/api/notifications/subscribe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "user-1",
          subscription: {
            endpoint: "https://push.example.com/send/123",
          },
        }),
      }
    );
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("upserts by endpoint (updates existing subscription)", async () => {
    const endpoint = "https://fcm.googleapis.com/fcm/send/existing";
    mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1" });
    mockPrisma.pushSubscription.upsert.mockResolvedValue({
      id: "sub-1",
      userId: "user-1",
      endpoint,
      p256dh: "NEW_KEY",
      auth: "NEW_AUTH",
    });

    const req = mockRequest(
      "http://localhost:3000/api/notifications/subscribe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "user-1",
          subscription: {
            endpoint,
            keys: { p256dh: "NEW_KEY", auth: "NEW_AUTH" },
          },
        }),
      }
    );
    await POST(req);

    expect(mockPrisma.pushSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { endpoint },
        update: { p256dh: "NEW_KEY", auth: "NEW_AUTH" },
      })
    );
  });
});
