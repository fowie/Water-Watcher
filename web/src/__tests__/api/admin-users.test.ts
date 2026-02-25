/**
 * Tests for the Admin Users API route handlers.
 *
 * Routes:
 *   POST  /api/admin/users        — list users with search/pagination (admin only)
 *   PATCH /api/admin/users/[id]   — update user role (admin only)
 *
 * Coverage:
 * - POST /api/admin/users requires admin auth (401/403)
 * - POST returns paginated user list
 * - POST supports search by name/email
 * - POST supports limit/offset pagination
 * - POST returns user counts (rivers, trips, reviews)
 * - PATCH /api/admin/users/[id] requires admin auth (401/403)
 * - PATCH updates user role to "admin" or "user"
 * - PATCH returns 400 for invalid role
 * - PATCH returns 404 for unknown user
 * - PATCH prevents self-demotion
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
}));

const mockAuth = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

import { POST } from "@/app/api/admin/users/route";
import { PATCH } from "@/app/api/admin/users/[id]/route";

const ADMIN_ID = "admin-1";
const USER_ID = "user-1";

function mockJsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePatchRequest(body: unknown): Request {
  return new Request("http://localhost/api/admin/users/user-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeIdContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

const SAMPLE_USER = {
  id: USER_ID,
  email: "user@test.com",
  name: "Test User",
  role: "user",
  image: null,
  emailVerified: null,
  createdAt: new Date("2026-01-01"),
  _count: { trackedRivers: 3, trips: 2, reviews: 5 },
};

describe("POST /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: ADMIN_ID, role: "admin" } });
    mockPrisma.user.findMany.mockResolvedValue([SAMPLE_USER]);
    mockPrisma.user.count.mockResolvedValue(1);
  });

  it("returns 401 without auth", async () => {
    mockAuth.mockResolvedValue(null);
    const req = mockJsonRequest("http://localhost/api/admin/users", {});
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin user", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_ID, role: "user" } });
    const req = mockJsonRequest("http://localhost/api/admin/users", {});
    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Admin");
  });

  it("returns paginated user list", async () => {
    const req = mockJsonRequest("http://localhost/api/admin/users", {});
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.users).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.limit).toBe(20);
    expect(data.offset).toBe(0);
  });

  it("returns user with expected fields", async () => {
    const req = mockJsonRequest("http://localhost/api/admin/users", {});
    const res = await POST(req);
    const data = await res.json();

    const user = data.users[0];
    expect(user.id).toBe(USER_ID);
    expect(user.email).toBe("user@test.com");
    expect(user.name).toBe("Test User");
    expect(user.role).toBe("user");
    expect(user.riverCount).toBe(3);
    expect(user.tripCount).toBe(2);
    expect(user.reviewCount).toBe(5);
  });

  it("supports search filter", async () => {
    const req = mockJsonRequest("http://localhost/api/admin/users", {
      search: "test",
    });
    await POST(req);

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              name: { contains: "test", mode: "insensitive" },
            }),
          ]),
        }),
      })
    );
  });

  it("supports custom limit and offset", async () => {
    const req = mockJsonRequest("http://localhost/api/admin/users", {
      limit: 5,
      offset: 10,
    });
    await POST(req);

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        skip: 10,
      })
    );
  });

  it("clamps limit to max 100", async () => {
    const req = mockJsonRequest("http://localhost/api/admin/users", {
      limit: 500,
    });
    await POST(req);

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    );
  });

  it("clamps offset to min 0", async () => {
    const req = mockJsonRequest("http://localhost/api/admin/users", {
      offset: -5,
    });
    await POST(req);

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0 })
    );
  });

  it("handles empty body gracefully", async () => {
    const req = new Request("http://localhost/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.user.findMany.mockRejectedValue(new Error("DB error"));
    const req = mockJsonRequest("http://localhost/api/admin/users", {});
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  // ─── Additional edge cases ─────────────────────────

  it("returns 401 when session user has no id", async () => {
    mockAuth.mockResolvedValue({ user: { role: "admin" } });
    const req = mockJsonRequest("http://localhost/api/admin/users", {});
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("trims search whitespace", async () => {
    const req = mockJsonRequest("http://localhost/api/admin/users", {
      search: "  alice  ",
    });
    await POST(req);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: "alice", mode: "insensitive" } },
            { email: { contains: "alice", mode: "insensitive" } },
          ],
        },
      })
    );
  });

  it("handles special characters in search (quotes/apostrophes)", async () => {
    const req = mockJsonRequest("http://localhost/api/admin/users", {
      search: "O'Brien",
    });
    await POST(req);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: "O'Brien", mode: "insensitive" } },
            { email: { contains: "O'Brien", mode: "insensitive" } },
          ],
        },
      })
    );
  });

  it("handles SQL-wildcard characters in search as literal strings", async () => {
    const req = mockJsonRequest("http://localhost/api/admin/users", {
      search: "a%b_c*d",
    });
    await POST(req);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: "a%b_c*d", mode: "insensitive" } },
            { email: { contains: "a%b_c*d", mode: "insensitive" } },
          ],
        },
      })
    );
  });

  it("handles unicode/CJK search", async () => {
    const req = mockJsonRequest("http://localhost/api/admin/users", {
      search: "名前",
    });
    await POST(req);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: "名前", mode: "insensitive" } },
            { email: { contains: "名前", mode: "insensitive" } },
          ],
        },
      })
    );
  });

  it("non-string search value treated as no search", async () => {
    const req = mockJsonRequest("http://localhost/api/admin/users", {
      search: 12345,
    });
    await POST(req);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });

  it("limit=0 falls back to default 20 (0 is falsy)", async () => {
    const req = mockJsonRequest("http://localhost/api/admin/users", {
      limit: 0,
    });
    await POST(req);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 })
    );
  });

  it("clamps limit to min 1 for negative values", async () => {
    const req = mockJsonRequest("http://localhost/api/admin/users", {
      limit: -10,
    });
    await POST(req);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 })
    );
  });

  it("orders results by createdAt desc", async () => {
    const req = mockJsonRequest("http://localhost/api/admin/users", {});
    await POST(req);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } })
    );
  });

  it("does not expose passwordHash in select clause", async () => {
    const req = mockJsonRequest("http://localhost/api/admin/users", {});
    await POST(req);
    const selectArg = mockPrisma.user.findMany.mock.calls[0][0]?.select;
    expect(selectArg).toBeDefined();
    expect(selectArg.passwordHash).toBeUndefined();
  });

  it("handles malformed JSON body gracefully", async () => {
    const req = new Request("http://localhost/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json",
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200); // falls to defaults
  });

  it("count query uses same where clause as findMany", async () => {
    const req = mockJsonRequest("http://localhost/api/admin/users", {
      search: "bob",
    });
    await POST(req);
    const findManyWhere = mockPrisma.user.findMany.mock.calls[0][0]?.where;
    const countWhere = mockPrisma.user.count.mock.calls[0][0]?.where;
    expect(countWhere).toEqual(findManyWhere);
  });
});

describe("PATCH /api/admin/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: ADMIN_ID, role: "admin" } });
    mockPrisma.user.findUnique.mockResolvedValue({ id: USER_ID, role: "user" });
    mockPrisma.user.update.mockResolvedValue({
      id: USER_ID,
      email: "user@test.com",
      name: "Test User",
      role: "admin",
      image: null,
      createdAt: new Date("2026-01-01"),
    });
  });

  it("returns 401 without auth", async () => {
    mockAuth.mockResolvedValue(null);
    const req = makePatchRequest({ role: "admin" });
    const res = await PATCH(req, makeIdContext(USER_ID));
    expect(res.status).toBe(401);
  });

  it("returns 403 for non-admin user", async () => {
    mockAuth.mockResolvedValue({ user: { id: USER_ID, role: "user" } });
    const req = makePatchRequest({ role: "admin" });
    const res = await PATCH(req, makeIdContext(USER_ID));
    expect(res.status).toBe(403);
  });

  it("updates user role to admin", async () => {
    const req = makePatchRequest({ role: "admin" });
    const res = await PATCH(req, makeIdContext(USER_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.role).toBe("admin");
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_ID },
        data: { role: "admin" },
      })
    );
  });

  it("updates user role to user", async () => {
    const req = makePatchRequest({ role: "user" });
    mockPrisma.user.update.mockResolvedValue({
      id: USER_ID,
      email: "user@test.com",
      name: "Test User",
      role: "user",
      image: null,
      createdAt: new Date("2026-01-01"),
    });
    const res = await PATCH(req, makeIdContext(USER_ID));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.role).toBe("user");
  });

  it("returns 400 for invalid role", async () => {
    const req = makePatchRequest({ role: "superadmin" });
    const res = await PATCH(req, makeIdContext(USER_ID));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBeDefined();
  });

  it("returns 404 for unknown user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const req = makePatchRequest({ role: "admin" });
    const res = await PATCH(req, makeIdContext("unknown-id"));
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toContain("not found");
  });

  it("prevents self-demotion", async () => {
    const req = makePatchRequest({ role: "user" });
    const res = await PATCH(req, makeIdContext(ADMIN_ID));
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("own admin role");
  });

  it("returns 500 on database error", async () => {
    mockPrisma.user.update.mockRejectedValue(new Error("DB error"));
    const req = makePatchRequest({ role: "admin" });
    const res = await PATCH(req, makeIdContext(USER_ID));
    expect(res.status).toBe(500);
  });

  // ─── Additional edge cases ─────────────────────────

  it("rejects empty role string", async () => {
    const req = makePatchRequest({ role: "" });
    const res = await PATCH(req, makeIdContext(USER_ID));
    expect(res.status).toBe(400);
  });

  it("rejects missing role field", async () => {
    const req = makePatchRequest({});
    const res = await PATCH(req, makeIdContext(USER_ID));
    expect(res.status).toBe(400);
  });

  it("rejects numeric role", async () => {
    const req = makePatchRequest({ role: 1 });
    const res = await PATCH(req, makeIdContext(USER_ID));
    expect(res.status).toBe(400);
  });

  it("allows admin to keep own role as admin (no-op)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: ADMIN_ID,
      role: "admin",
    });
    mockPrisma.user.update.mockResolvedValue({
      id: ADMIN_ID,
      email: "admin@test.com",
      name: "Admin",
      role: "admin",
      image: null,
      createdAt: new Date("2026-01-01"),
    });

    const req = makePatchRequest({ role: "admin" });
    const res = await PATCH(req, makeIdContext(ADMIN_ID));
    expect(res.status).toBe(200);
  });

  it("returns updated user with all expected fields", async () => {
    const req = makePatchRequest({ role: "admin" });
    const res = await PATCH(req, makeIdContext(USER_ID));
    const data = await res.json();
    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("email");
    expect(data).toHaveProperty("name");
    expect(data).toHaveProperty("role");
    expect(data).toHaveProperty("createdAt");
  });

  it("calls Prisma update with select clause (no passwordHash)", async () => {
    const req = makePatchRequest({ role: "admin" });
    await PATCH(req, makeIdContext(USER_ID));
    const updateCall = mockPrisma.user.update.mock.calls[0][0];
    expect(updateCall.select).toBeDefined();
    expect(updateCall.select.passwordHash).toBeUndefined();
  });

  it("returns 500 on findUnique database error", async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error("DB error"));
    const req = makePatchRequest({ role: "admin" });
    const res = await PATCH(req, makeIdContext(USER_ID));
    expect(res.status).toBe(500);
  });
});
