/**
 * Tests for the Deal Filters [id] API route handler.
 *
 * Tests:
 * - GET /api/deals/filters/:id
 * - PATCH /api/deals/filters/:id (update with ownership check)
 * - DELETE /api/deals/filters/:id
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  dealFilter: {
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

import { GET, PATCH, DELETE } from "@/app/api/deals/filters/[id]/route";

function mockRequest(url: string, options: RequestInit = {}): Request {
  return new Request(url, options);
}

describe("GET /api/deals/filters/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns filter when found", async () => {
    const filter = {
      id: "f1",
      userId: "user-1",
      name: "Raft deals",
      keywords: ["raft"],
      _count: { matches: 2 },
    };
    mockPrisma.dealFilter.findUnique.mockResolvedValue(filter);

    const req = mockRequest("http://localhost:3000/api/deals/filters/f1");
    const res = await GET(req, { params: Promise.resolve({ id: "f1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.name).toBe("Raft deals");
  });

  it("returns 404 when not found", async () => {
    mockPrisma.dealFilter.findUnique.mockResolvedValue(null);

    const req = mockRequest("http://localhost:3000/api/deals/filters/nonexistent");
    const res = await GET(req, { params: Promise.resolve({ id: "nonexistent" }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Deal filter not found");
  });
});

describe("PATCH /api/deals/filters/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates a filter with valid data", async () => {
    const existing = { id: "f1", userId: "user-1", name: "Old", keywords: ["raft"], isActive: true };
    const updated = { ...existing, name: "New Name" };
    mockPrisma.dealFilter.findUnique.mockResolvedValue(existing);
    mockPrisma.dealFilter.update.mockResolvedValue(updated);

    const req = mockRequest("http://localhost:3000/api/deals/filters/f1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-1", name: "New Name" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "f1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.name).toBe("New Name");
  });

  it("returns 404 when filter not found", async () => {
    mockPrisma.dealFilter.findUnique.mockResolvedValue(null);

    const req = mockRequest("http://localhost:3000/api/deals/filters/nonexistent", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-1", name: "Updated" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "nonexistent" }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Deal filter not found");
  });

  it("returns 403 when userId does not match filter owner", async () => {
    const existing = { id: "f1", userId: "user-1", name: "Private", keywords: ["raft"] };
    mockPrisma.dealFilter.findUnique.mockResolvedValue(existing);

    const req = mockRequest("http://localhost:3000/api/deals/filters/f1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-999", name: "Hacked" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "f1" }) });
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toBe("Not authorized to update this filter");
    expect(mockPrisma.dealFilter.update).not.toHaveBeenCalled();
  });

  it("returns 400 when userId is missing", async () => {
    const existing = { id: "f1", userId: "user-1", name: "Test", keywords: ["raft"] };
    mockPrisma.dealFilter.findUnique.mockResolvedValue(existing);

    const req = mockRequest("http://localhost:3000/api/deals/filters/f1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Updated" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "f1" }) });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("userId is required");
  });

  it("returns 400 for invalid update data", async () => {
    const req = mockRequest("http://localhost:3000/api/deals/filters/f1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-1", maxPrice: -50 }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "f1" }) });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid input");
  });

  it("can toggle isActive off", async () => {
    const existing = { id: "f1", userId: "user-1", name: "Test", keywords: ["raft"], isActive: true };
    const updated = { ...existing, isActive: false };
    mockPrisma.dealFilter.findUnique.mockResolvedValue(existing);
    mockPrisma.dealFilter.update.mockResolvedValue(updated);

    const req = mockRequest("http://localhost:3000/api/deals/filters/f1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-1", isActive: false }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "f1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isActive).toBe(false);
  });

  it("returns 500 on database error", async () => {
    const existing = { id: "f1", userId: "user-1", name: "Test", keywords: ["raft"] };
    mockPrisma.dealFilter.findUnique.mockResolvedValue(existing);
    mockPrisma.dealFilter.update.mockRejectedValue(new Error("DB error"));

    const req = mockRequest("http://localhost:3000/api/deals/filters/f1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-1", name: "Updated" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "f1" }) });
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });

  it("rejects empty keywords array", async () => {
    const req = mockRequest("http://localhost:3000/api/deals/filters/f1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-1", keywords: [] }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "f1" }) });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid input");
  });

  it("strips unknown fields from update payload", async () => {
    const existing = { id: "f1", userId: "user-1", name: "Test", keywords: ["raft"], isActive: true };
    mockPrisma.dealFilter.findUnique.mockResolvedValue(existing);
    mockPrisma.dealFilter.update.mockResolvedValue({ ...existing, name: "Clean" });

    const req = mockRequest("http://localhost:3000/api/deals/filters/f1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-1", name: "Clean", hackerField: "evil" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "f1" }) });

    expect(res.status).toBe(200);
    const updateCall = mockPrisma.dealFilter.update.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty("hackerField");
    expect(updateCall.data).not.toHaveProperty("userId");
  });

  it("can update maxPrice to null (remove price ceiling)", async () => {
    const existing = { id: "f1", userId: "user-1", name: "Test", keywords: ["raft"], maxPrice: 500 };
    const updated = { ...existing, maxPrice: null };
    mockPrisma.dealFilter.findUnique.mockResolvedValue(existing);
    mockPrisma.dealFilter.update.mockResolvedValue(updated);

    const req = mockRequest("http://localhost:3000/api/deals/filters/f1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-1", maxPrice: null }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "f1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.maxPrice).toBeNull();
  });

  it("rejects zero maxPrice (must be positive)", async () => {
    const req = mockRequest("http://localhost:3000/api/deals/filters/f1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-1", maxPrice: 0 }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "f1" }) });

    expect(res.status).toBe(400);
  });

  it("can update multiple fields simultaneously", async () => {
    const existing = { id: "f1", userId: "user-1", name: "Old", keywords: ["raft"], isActive: true, regions: [] };
    const updated = { ...existing, name: "New", keywords: ["kayak", "canoe"], regions: ["denver"] };
    mockPrisma.dealFilter.findUnique.mockResolvedValue(existing);
    mockPrisma.dealFilter.update.mockResolvedValue(updated);

    const req = mockRequest("http://localhost:3000/api/deals/filters/f1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "user-1",
        name: "New",
        keywords: ["kayak", "canoe"],
        regions: ["denver"],
      }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "f1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.name).toBe("New");
    expect(data.keywords).toEqual(["kayak", "canoe"]);
    expect(data.regions).toEqual(["denver"]);
  });

  it("rejects empty name string", async () => {
    const req = mockRequest("http://localhost:3000/api/deals/filters/f1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "user-1", name: "" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "f1" }) });

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/deals/filters/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes a filter and returns 204", async () => {
    mockPrisma.dealFilter.findUnique.mockResolvedValue({ id: "f1", userId: "user-1" });
    mockPrisma.dealFilter.delete.mockResolvedValue({ id: "f1" });

    const req = mockRequest("http://localhost:3000/api/deals/filters/f1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "f1" }) });

    expect(res.status).toBe(204);
    expect(mockPrisma.dealFilter.delete).toHaveBeenCalledWith({ where: { id: "f1" } });
  });

  it("returns 404 when filter does not exist", async () => {
    mockPrisma.dealFilter.findUnique.mockResolvedValue(null);

    const req = mockRequest("http://localhost:3000/api/deals/filters/nonexistent", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "nonexistent" }) });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Deal filter not found");
  });
});
