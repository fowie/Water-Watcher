/**
 * Tests for the River Photos API route handlers.
 *
 * Routes:
 *   GET    /api/rivers/:id/photos           — paginated list (public)
 *   POST   /api/rivers/:id/photos           — create photo (auth + rate limit)
 *   DELETE /api/rivers/:id/photos/:photoId  — delete photo (owner only)
 *
 * Coverage:
 * - GET photos returns paginated list (public, no auth needed)
 * - GET with limit/offset params
 * - GET for non-existent river returns 404
 * - POST creates photo (auth required)
 * - POST returns 401 without auth
 * - POST validates required fields (url required)
 * - POST enforces 20-photo limit per user per river
 * - POST validates river exists (404)
 * - DELETE removes photo (owner only, 204)
 * - DELETE returns 403 for non-owner
 * - DELETE returns 404 for non-existent photo
 * - Rate limiting on POST
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  river: {
    findUnique: vi.fn(),
  },
  riverPhoto: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockAuth = vi.hoisted(() => vi.fn());
const mockRateLimit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mockRateLimit,
  defaultConfig: { maxTokens: 60, refillRate: 1, refillInterval: 1 },
  reviewConfig: { maxTokens: 10, refillRate: 10 / 60, refillInterval: 1 },
  resetRateLimiter: vi.fn(),
}));

import { GET, POST } from "@/app/api/rivers/[id]/photos/route";
import { DELETE } from "@/app/api/rivers/[id]/photos/[photoId]/route";

function mockRequest(url: string, options: RequestInit = {}): Request {
  return new Request(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
}

function makePhotoContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makePhotoDeleteContext(id: string, photoId: string) {
  return { params: Promise.resolve({ id, photoId }) };
}

const USER_ID = "user-1";
const RIVER_ID = "river-1";
const OTHER_USER_ID = "user-2";
const PHOTO_ID = "photo-1";

const SAMPLE_RIVER = { id: RIVER_ID, name: "Colorado River", state: "CO" };

const SAMPLE_PHOTO = {
  id: PHOTO_ID,
  riverId: RIVER_ID,
  userId: USER_ID,
  url: "https://example.com/photo.jpg",
  caption: "Beautiful rapids",
  takenAt: new Date("2026-06-15"),
  createdAt: new Date("2026-06-15"),
  user: { id: USER_ID, name: "Test User", image: null },
};

describe("GET /api/rivers/:id/photos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockReturnValue({ success: true, remaining: 9, reset: Math.ceil(Date.now() / 1000) + 60 });
  });

  it("returns paginated list of photos (public, no auth needed)", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverPhoto.findMany.mockResolvedValue([SAMPLE_PHOTO]);
    mockPrisma.riverPhoto.count.mockResolvedValue(1);

    const req = mockRequest("http://localhost/api/rivers/river-1/photos");
    const res = await GET(req, makePhotoContext(RIVER_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.photos).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.limit).toBeDefined();
    expect(data.offset).toBeDefined();
  });

  it("defaults to limit=20 and offset=0", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverPhoto.findMany.mockResolvedValue([]);
    mockPrisma.riverPhoto.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost/api/rivers/river-1/photos");
    await GET(req, makePhotoContext(RIVER_ID));

    expect(mockPrisma.riverPhoto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20, skip: 0 })
    );
  });

  it("respects custom limit and offset params", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverPhoto.findMany.mockResolvedValue([]);
    mockPrisma.riverPhoto.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost/api/rivers/river-1/photos?limit=5&offset=10");
    await GET(req, makePhotoContext(RIVER_ID));

    expect(mockPrisma.riverPhoto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5, skip: 10 })
    );
  });

  it("clamps limit to max 100", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverPhoto.findMany.mockResolvedValue([]);
    mockPrisma.riverPhoto.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost/api/rivers/river-1/photos?limit=200");
    await GET(req, makePhotoContext(RIVER_ID));

    expect(mockPrisma.riverPhoto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    );
  });

  it("clamps limit to min 1", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverPhoto.findMany.mockResolvedValue([]);
    mockPrisma.riverPhoto.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost/api/rivers/river-1/photos?limit=0");
    await GET(req, makePhotoContext(RIVER_ID));

    expect(mockPrisma.riverPhoto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 })
    );
  });

  it("clamps offset to min 0", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverPhoto.findMany.mockResolvedValue([]);
    mockPrisma.riverPhoto.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost/api/rivers/river-1/photos?offset=-5");
    await GET(req, makePhotoContext(RIVER_ID));

    expect(mockPrisma.riverPhoto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0 })
    );
  });

  it("returns 404 for non-existent river", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(null);

    const req = mockRequest("http://localhost/api/rivers/fake-river/photos");
    const res = await GET(req, makePhotoContext("fake-river"));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain("River not found");
  });

  it("includes user info in photo response", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverPhoto.findMany.mockResolvedValue([SAMPLE_PHOTO]);
    mockPrisma.riverPhoto.count.mockResolvedValue(1);

    const req = mockRequest("http://localhost/api/rivers/river-1/photos");
    const res = await GET(req, makePhotoContext(RIVER_ID));
    const data = await res.json();

    expect(data.photos[0].user).toBeDefined();
    expect(data.photos[0].user.id).toBe(USER_ID);
    expect(data.photos[0].user.name).toBe("Test User");
  });

  it("orders photos by createdAt descending", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverPhoto.findMany.mockResolvedValue([]);
    mockPrisma.riverPhoto.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost/api/rivers/river-1/photos");
    await GET(req, makePhotoContext(RIVER_ID));

    expect(mockPrisma.riverPhoto.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } })
    );
  });

  it("returns empty photos array for river with no photos", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverPhoto.findMany.mockResolvedValue([]);
    mockPrisma.riverPhoto.count.mockResolvedValue(0);

    const req = mockRequest("http://localhost/api/rivers/river-1/photos");
    const res = await GET(req, makePhotoContext(RIVER_ID));
    const data = await res.json();

    expect(data.photos).toEqual([]);
    expect(data.total).toBe(0);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.river.findUnique.mockRejectedValue(new Error("DB down"));

    const req = mockRequest("http://localhost/api/rivers/river-1/photos");
    const res = await GET(req, makePhotoContext(RIVER_ID));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });
});

describe("POST /api/rivers/:id/photos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: USER_ID } });
    mockRateLimit.mockReturnValue({ success: true, remaining: 9, reset: Math.ceil(Date.now() / 1000) + 60 });
  });

  it("creates a photo successfully (201)", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverPhoto.count.mockResolvedValue(0);
    mockPrisma.riverPhoto.create.mockResolvedValue(SAMPLE_PHOTO);

    const req = mockRequest("http://localhost/api/rivers/river-1/photos", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/photo.jpg",
        caption: "Beautiful rapids",
      }),
    });
    const res = await POST(req, makePhotoContext(RIVER_ID));
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.url).toBe("https://example.com/photo.jpg");
  });

  it("returns 401 without auth", async () => {
    mockAuth.mockResolvedValue(null);

    const req = mockRequest("http://localhost/api/rivers/river-1/photos", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/photo.jpg" }),
    });
    const res = await POST(req, makePhotoContext(RIVER_ID));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain("Authentication required");
  });

  it("validates url is required (400)", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);

    const req = mockRequest("http://localhost/api/rivers/river-1/photos", {
      method: "POST",
      body: JSON.stringify({ caption: "No URL" }),
    });
    const res = await POST(req, makePhotoContext(RIVER_ID));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid input");
  });

  it("validates empty url string is rejected (400)", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);

    const req = mockRequest("http://localhost/api/rivers/river-1/photos", {
      method: "POST",
      body: JSON.stringify({ url: "" }),
    });
    const res = await POST(req, makePhotoContext(RIVER_ID));

    expect(res.status).toBe(400);
  });

  it("returns 404 when river does not exist", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(null);

    const req = mockRequest("http://localhost/api/rivers/fake-river/photos", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/photo.jpg" }),
    });
    const res = await POST(req, makePhotoContext("fake-river"));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain("River not found");
  });

  it("enforces 20-photo limit per user per river", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverPhoto.count.mockResolvedValue(20);

    const req = mockRequest("http://localhost/api/rivers/river-1/photos", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/photo21.jpg" }),
    });
    const res = await POST(req, makePhotoContext(RIVER_ID));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("Maximum 20 photos");
  });

  it("allows photo when count is 19 (under limit)", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverPhoto.count.mockResolvedValue(19);
    mockPrisma.riverPhoto.create.mockResolvedValue(SAMPLE_PHOTO);

    const req = mockRequest("http://localhost/api/rivers/river-1/photos", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/photo20.jpg" }),
    });
    const res = await POST(req, makePhotoContext(RIVER_ID));

    expect(res.status).toBe(201);
  });

  it("checks photo count scoped to user and river", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverPhoto.count.mockResolvedValue(0);
    mockPrisma.riverPhoto.create.mockResolvedValue(SAMPLE_PHOTO);

    const req = mockRequest("http://localhost/api/rivers/river-1/photos", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/photo.jpg" }),
    });
    await POST(req, makePhotoContext(RIVER_ID));

    expect(mockPrisma.riverPhoto.count).toHaveBeenCalledWith({
      where: { riverId: RIVER_ID, userId: USER_ID },
    });
  });

  it("creates photo with optional caption and takenAt", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverPhoto.count.mockResolvedValue(0);
    mockPrisma.riverPhoto.create.mockResolvedValue(SAMPLE_PHOTO);

    const req = mockRequest("http://localhost/api/rivers/river-1/photos", {
      method: "POST",
      body: JSON.stringify({
        url: "https://example.com/photo.jpg",
        caption: "Rapids shot",
        takenAt: "2026-06-15T10:00:00.000Z",
      }),
    });
    await POST(req, makePhotoContext(RIVER_ID));

    expect(mockPrisma.riverPhoto.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          url: "https://example.com/photo.jpg",
          caption: "Rapids shot",
          takenAt: expect.any(Date),
        }),
      })
    );
  });

  it("sets caption to null when not provided", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverPhoto.count.mockResolvedValue(0);
    mockPrisma.riverPhoto.create.mockResolvedValue(SAMPLE_PHOTO);

    const req = mockRequest("http://localhost/api/rivers/river-1/photos", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/photo.jpg" }),
    });
    await POST(req, makePhotoContext(RIVER_ID));

    expect(mockPrisma.riverPhoto.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          caption: null,
          takenAt: null,
        }),
      })
    );
  });

  it("returns 429 when rate limited", async () => {
    mockRateLimit.mockReturnValue({ success: false, remaining: 0, reset: Math.ceil(Date.now() / 1000) + 30 });

    const req = mockRequest("http://localhost/api/rivers/river-1/photos", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/photo.jpg" }),
    });
    const res = await POST(req, makePhotoContext(RIVER_ID));
    const data = await res.json();

    expect(res.status).toBe(429);
    expect(data.error).toContain("Too many requests");
  });

  it("returns 500 on database error during create", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverPhoto.count.mockResolvedValue(0);
    mockPrisma.riverPhoto.create.mockRejectedValue(new Error("DB error"));

    const req = mockRequest("http://localhost/api/rivers/river-1/photos", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/photo.jpg" }),
    });
    const res = await POST(req, makePhotoContext(RIVER_ID));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });

  it("includes user info in created photo response", async () => {
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.riverPhoto.count.mockResolvedValue(0);
    mockPrisma.riverPhoto.create.mockResolvedValue(SAMPLE_PHOTO);

    const req = mockRequest("http://localhost/api/rivers/river-1/photos", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com/photo.jpg" }),
    });
    const res = await POST(req, makePhotoContext(RIVER_ID));
    const data = await res.json();

    expect(data.user).toBeDefined();
    expect(data.user.id).toBe(USER_ID);
  });
});

describe("DELETE /api/rivers/:id/photos/:photoId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: USER_ID } });
    mockRateLimit.mockReturnValue({ success: true, remaining: 9, reset: Math.ceil(Date.now() / 1000) + 60 });
  });

  it("deletes photo successfully (204)", async () => {
    mockPrisma.riverPhoto.findFirst.mockResolvedValue({
      id: PHOTO_ID,
      riverId: RIVER_ID,
      userId: USER_ID,
    });
    mockPrisma.riverPhoto.delete.mockResolvedValue({});

    const req = mockRequest("http://localhost/api/rivers/river-1/photos/photo-1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makePhotoDeleteContext(RIVER_ID, PHOTO_ID));

    expect(res.status).toBe(204);
  });

  it("returns 401 without auth", async () => {
    mockAuth.mockResolvedValue(null);

    const req = mockRequest("http://localhost/api/rivers/river-1/photos/photo-1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makePhotoDeleteContext(RIVER_ID, PHOTO_ID));
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain("Authentication required");
  });

  it("returns 404 for non-existent photo", async () => {
    mockPrisma.riverPhoto.findFirst.mockResolvedValue(null);

    const req = mockRequest("http://localhost/api/rivers/river-1/photos/fake-photo", {
      method: "DELETE",
    });
    const res = await DELETE(req, makePhotoDeleteContext(RIVER_ID, "fake-photo"));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain("Photo not found");
  });

  it("returns 403 when non-owner tries to delete", async () => {
    mockPrisma.riverPhoto.findFirst.mockResolvedValue({
      id: PHOTO_ID,
      riverId: RIVER_ID,
      userId: OTHER_USER_ID,
    });

    const req = mockRequest("http://localhost/api/rivers/river-1/photos/photo-1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makePhotoDeleteContext(RIVER_ID, PHOTO_ID));
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain("only delete your own");
  });

  it("finds photo scoped to both photoId and riverId", async () => {
    mockPrisma.riverPhoto.findFirst.mockResolvedValue({
      id: PHOTO_ID,
      riverId: RIVER_ID,
      userId: USER_ID,
    });
    mockPrisma.riverPhoto.delete.mockResolvedValue({});

    const req = mockRequest("http://localhost/api/rivers/river-1/photos/photo-1", {
      method: "DELETE",
    });
    await DELETE(req, makePhotoDeleteContext(RIVER_ID, PHOTO_ID));

    expect(mockPrisma.riverPhoto.findFirst).toHaveBeenCalledWith({
      where: { id: PHOTO_ID, riverId: RIVER_ID },
    });
  });

  it("deletes by photoId only", async () => {
    mockPrisma.riverPhoto.findFirst.mockResolvedValue({
      id: PHOTO_ID,
      riverId: RIVER_ID,
      userId: USER_ID,
    });
    mockPrisma.riverPhoto.delete.mockResolvedValue({});

    const req = mockRequest("http://localhost/api/rivers/river-1/photos/photo-1", {
      method: "DELETE",
    });
    await DELETE(req, makePhotoDeleteContext(RIVER_ID, PHOTO_ID));

    expect(mockPrisma.riverPhoto.delete).toHaveBeenCalledWith({
      where: { id: PHOTO_ID },
    });
  });

  it("returns 500 on database error", async () => {
    mockPrisma.riverPhoto.findFirst.mockRejectedValue(new Error("DB down"));

    const req = mockRequest("http://localhost/api/rivers/river-1/photos/photo-1", {
      method: "DELETE",
    });
    const res = await DELETE(req, makePhotoDeleteContext(RIVER_ID, PHOTO_ID));
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });
});
