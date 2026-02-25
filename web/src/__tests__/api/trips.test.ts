/**
 * Tests for the Trip Planner API.
 *
 * Routes:
 *   GET    /api/trips         — list user's trips (auth required)
 *   POST   /api/trips         — create a trip
 *   GET    /api/trips/:id     — get trip with stops & river details
 *   PATCH  /api/trips/:id     — update trip (owner only)
 *   DELETE /api/trips/:id     — delete trip (owner only)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  trip: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockAuth = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

import { GET as listTrips, POST as createTrip } from "@/app/api/trips/route";
import {
  GET as getTrip,
  PATCH as patchTrip,
  DELETE as deleteTrip,
} from "@/app/api/trips/[id]/route";

function mockRequest(url: string, options: RequestInit = {}): Request {
  return new Request(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
}

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

const USER_ID = "user-1";
const OTHER_USER = "user-2";

const SAMPLE_TRIP = {
  id: "trip-1",
  name: "Colorado Adventure",
  startDate: "2026-06-15T00:00:00.000Z",
  endDate: "2026-06-20T00:00:00.000Z",
  status: "planning",
  notes: "Bring sunscreen",
  isPublic: false,
  userId: USER_ID,
  createdAt: "2026-02-24T00:00:00.000Z",
  updatedAt: "2026-02-24T00:00:00.000Z",
};

const SAMPLE_STOP = {
  id: "stop-1",
  tripId: "trip-1",
  riverId: "river-1",
  dayNumber: 1,
  sortOrder: 0,
  notes: null,
  putInTime: null,
  takeOutTime: null,
  river: {
    id: "river-1",
    name: "Colorado River",
    state: "CO",
    difficulty: "III",
    latitude: 39.0,
    longitude: -106.0,
  },
};

describe("GET /api/trips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: USER_ID, email: "test@example.com" } });
  });

  it("returns 401 without authentication", async () => {
    mockAuth.mockResolvedValue(null);
    const req = mockRequest("http://localhost:3000/api/trips");
    const res = await listTrips(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Authentication required");
  });

  it("returns user's trips", async () => {
    mockPrisma.trip.findMany.mockResolvedValue([
      { ...SAMPLE_TRIP, stops: [SAMPLE_STOP], _count: { stops: 1 } },
    ]);
    const req = mockRequest("http://localhost:3000/api/trips");
    const res = await listTrips(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.trips).toHaveLength(1);
    expect(data.trips[0].name).toBe("Colorado Adventure");
    expect(mockPrisma.trip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
      })
    );
  });

  it("filters by status query param", async () => {
    mockPrisma.trip.findMany.mockResolvedValue([]);
    const req = mockRequest("http://localhost:3000/api/trips?status=completed");
    const res = await listTrips(req);
    expect(res.status).toBe(200);
    expect(mockPrisma.trip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID, status: "completed" },
      })
    );
  });

  it("filters upcoming trips when upcoming=true", async () => {
    mockPrisma.trip.findMany.mockResolvedValue([]);
    const req = mockRequest("http://localhost:3000/api/trips?upcoming=true");
    const res = await listTrips(req);
    expect(res.status).toBe(200);
    expect(mockPrisma.trip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: USER_ID,
          startDate: { gte: expect.any(Date) },
        },
      })
    );
  });

  it("does not apply upcoming filter when upcoming is not 'true'", async () => {
    mockPrisma.trip.findMany.mockResolvedValue([]);
    const req = mockRequest("http://localhost:3000/api/trips?upcoming=false");
    const res = await listTrips(req);
    expect(res.status).toBe(200);
    expect(mockPrisma.trip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
      })
    );
  });

  it("orders trips by startDate ascending", async () => {
    mockPrisma.trip.findMany.mockResolvedValue([]);
    const req = mockRequest("http://localhost:3000/api/trips");
    await listTrips(req);
    expect(mockPrisma.trip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { startDate: "asc" },
      })
    );
  });

  it("includes stops with river details and counts", async () => {
    mockPrisma.trip.findMany.mockResolvedValue([]);
    const req = mockRequest("http://localhost:3000/api/trips");
    await listTrips(req);
    expect(mockPrisma.trip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          stops: expect.objectContaining({
            include: expect.objectContaining({
              river: expect.objectContaining({
                select: expect.objectContaining({ name: true }),
              }),
            }),
          }),
          _count: { select: { stops: true } },
        }),
      })
    );
  });
});

describe("POST /api/trips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: USER_ID, email: "test@example.com" } });
  });

  it("creates a trip with valid data", async () => {
    mockPrisma.trip.create.mockResolvedValue(SAMPLE_TRIP);
    const req = mockRequest("http://localhost:3000/api/trips", {
      method: "POST",
      body: JSON.stringify({
        name: "Colorado Adventure",
        startDate: "2026-06-15T00:00:00.000Z",
        endDate: "2026-06-20T00:00:00.000Z",
      }),
    });
    const res = await createTrip(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.name).toBe("Colorado Adventure");
    expect(mockPrisma.trip.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Colorado Adventure",
        userId: USER_ID,
        startDate: expect.any(Date),
        endDate: expect.any(Date),
      }),
    });
  });

  it("returns 400 when name is missing", async () => {
    const req = mockRequest("http://localhost:3000/api/trips", {
      method: "POST",
      body: JSON.stringify({
        startDate: "2026-06-15T00:00:00.000Z",
        endDate: "2026-06-20T00:00:00.000Z",
      }),
    });
    const res = await createTrip(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid input");
  });

  it("returns 400 when endDate is before startDate", async () => {
    const req = mockRequest("http://localhost:3000/api/trips", {
      method: "POST",
      body: JSON.stringify({
        name: "Bad Trip",
        startDate: "2026-06-20T00:00:00.000Z",
        endDate: "2026-06-15T00:00:00.000Z",
      }),
    });
    const res = await createTrip(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid input");
  });

  it("returns 400 for invalid status value", async () => {
    const req = mockRequest("http://localhost:3000/api/trips", {
      method: "POST",
      body: JSON.stringify({
        name: "Bad Status",
        startDate: "2026-06-15T00:00:00.000Z",
        endDate: "2026-06-20T00:00:00.000Z",
        status: "invalid_status",
      }),
    });
    const res = await createTrip(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid input");
  });

  it("returns 401 without authentication", async () => {
    mockAuth.mockResolvedValue(null);
    const req = mockRequest("http://localhost:3000/api/trips", {
      method: "POST",
      body: JSON.stringify({
        name: "Trip",
        startDate: "2026-06-15T00:00:00.000Z",
        endDate: "2026-06-20T00:00:00.000Z",
      }),
    });
    const res = await createTrip(req);
    expect(res.status).toBe(401);
  });

  it("defaults status to 'planning'", async () => {
    mockPrisma.trip.create.mockResolvedValue({
      ...SAMPLE_TRIP,
      status: "planning",
    });
    const req = mockRequest("http://localhost:3000/api/trips", {
      method: "POST",
      body: JSON.stringify({
        name: "Default Status",
        startDate: "2026-06-15T00:00:00.000Z",
        endDate: "2026-06-20T00:00:00.000Z",
      }),
    });
    const res = await createTrip(req);
    expect(res.status).toBe(201);
    expect(mockPrisma.trip.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "planning",
      }),
    });
  });

  it("allows setting isPublic to true", async () => {
    mockPrisma.trip.create.mockResolvedValue({
      ...SAMPLE_TRIP,
      isPublic: true,
    });
    const req = mockRequest("http://localhost:3000/api/trips", {
      method: "POST",
      body: JSON.stringify({
        name: "Public Trip",
        startDate: "2026-06-15T00:00:00.000Z",
        endDate: "2026-06-20T00:00:00.000Z",
        isPublic: true,
      }),
    });
    const res = await createTrip(req);
    expect(res.status).toBe(201);
    expect(mockPrisma.trip.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isPublic: true,
      }),
    });
  });
});

describe("GET /api/trips/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: USER_ID, email: "test@example.com" } });
  });

  it("returns trip with stops and river details", async () => {
    mockPrisma.trip.findUnique.mockResolvedValue({
      ...SAMPLE_TRIP,
      stops: [SAMPLE_STOP],
    });
    const req = mockRequest("http://localhost:3000/api/trips/trip-1");
    const res = await getTrip(req, makeContext("trip-1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("Colorado Adventure");
    expect(data.stops).toHaveLength(1);
    expect(data.stops[0].river.name).toBe("Colorado River");
  });

  it("returns 404 for non-existent trip", async () => {
    mockPrisma.trip.findUnique.mockResolvedValue(null);
    const req = mockRequest("http://localhost:3000/api/trips/nonexistent");
    const res = await getTrip(req, makeContext("nonexistent"));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Trip not found");
  });

  it("allows access to public trip by non-owner", async () => {
    mockPrisma.trip.findUnique.mockResolvedValue({
      ...SAMPLE_TRIP,
      isPublic: true,
      userId: OTHER_USER,
      stops: [],
    });
    const req = mockRequest("http://localhost:3000/api/trips/trip-1");
    const res = await getTrip(req, makeContext("trip-1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isPublic).toBe(true);
  });

  it("returns 404 for private trip accessed by non-owner", async () => {
    mockPrisma.trip.findUnique.mockResolvedValue({
      ...SAMPLE_TRIP,
      isPublic: false,
      userId: OTHER_USER,
      stops: [],
    });
    const req = mockRequest("http://localhost:3000/api/trips/trip-1");
    const res = await getTrip(req, makeContext("trip-1"));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Trip not found");
  });

  it("includes river lat/lng in stop details", async () => {
    mockPrisma.trip.findUnique.mockResolvedValue({
      ...SAMPLE_TRIP,
      stops: [SAMPLE_STOP],
    });
    const req = mockRequest("http://localhost:3000/api/trips/trip-1");
    await getTrip(req, makeContext("trip-1"));
    expect(mockPrisma.trip.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          stops: expect.objectContaining({
            include: expect.objectContaining({
              river: expect.objectContaining({
                select: expect.objectContaining({
                  latitude: true,
                  longitude: true,
                }),
              }),
            }),
          }),
        }),
      })
    );
  });

  it("returns 401 without authentication", async () => {
    mockAuth.mockResolvedValue(null);
    const req = mockRequest("http://localhost:3000/api/trips/trip-1");
    const res = await getTrip(req, makeContext("trip-1"));
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/trips/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: USER_ID, email: "test@example.com" } });
  });

  it("updates trip when user is owner", async () => {
    mockPrisma.trip.findUnique.mockResolvedValue(SAMPLE_TRIP);
    mockPrisma.trip.update.mockResolvedValue({
      ...SAMPLE_TRIP,
      name: "Updated Trip",
    });
    const req = mockRequest("http://localhost:3000/api/trips/trip-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated Trip" }),
    });
    const res = await patchTrip(req, makeContext("trip-1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.name).toBe("Updated Trip");
  });

  it("returns 403 for non-owner", async () => {
    mockPrisma.trip.findUnique.mockResolvedValue({
      ...SAMPLE_TRIP,
      userId: OTHER_USER,
    });
    const req = mockRequest("http://localhost:3000/api/trips/trip-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Hijacked" }),
    });
    const res = await patchTrip(req, makeContext("trip-1"));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Not authorized");
  });

  it("returns 404 for non-existent trip", async () => {
    mockPrisma.trip.findUnique.mockResolvedValue(null);
    const req = mockRequest("http://localhost:3000/api/trips/nope", {
      method: "PATCH",
      body: JSON.stringify({ name: "Nope" }),
    });
    const res = await patchTrip(req, makeContext("nope"));
    expect(res.status).toBe(404);
  });

  it("updates status field", async () => {
    mockPrisma.trip.findUnique.mockResolvedValue(SAMPLE_TRIP);
    mockPrisma.trip.update.mockResolvedValue({
      ...SAMPLE_TRIP,
      status: "completed",
    });
    const req = mockRequest("http://localhost:3000/api/trips/trip-1", {
      method: "PATCH",
      body: JSON.stringify({ status: "completed" }),
    });
    const res = await patchTrip(req, makeContext("trip-1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("completed");
  });

  it("returns 400 for invalid update data", async () => {
    const req = mockRequest("http://localhost:3000/api/trips/trip-1", {
      method: "PATCH",
      body: JSON.stringify({ status: "invalid_status" }),
    });
    const res = await patchTrip(req, makeContext("trip-1"));
    expect(res.status).toBe(400);
  });

  it("returns 401 without authentication", async () => {
    mockAuth.mockResolvedValue(null);
    const req = mockRequest("http://localhost:3000/api/trips/trip-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "No auth" }),
    });
    const res = await patchTrip(req, makeContext("trip-1"));
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/trips/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: USER_ID, email: "test@example.com" } });
  });

  it("deletes trip and returns 204 when user is owner", async () => {
    mockPrisma.trip.findUnique.mockResolvedValue(SAMPLE_TRIP);
    mockPrisma.trip.delete.mockResolvedValue(SAMPLE_TRIP);
    const req = mockRequest("http://localhost:3000/api/trips/trip-1", {
      method: "DELETE",
    });
    const res = await deleteTrip(req, makeContext("trip-1"));
    expect(res.status).toBe(204);
    expect(mockPrisma.trip.delete).toHaveBeenCalledWith({
      where: { id: "trip-1" },
    });
  });

  it("returns 404 for non-existent trip", async () => {
    mockPrisma.trip.findUnique.mockResolvedValue(null);
    const req = mockRequest("http://localhost:3000/api/trips/nope", {
      method: "DELETE",
    });
    const res = await deleteTrip(req, makeContext("nope"));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Trip not found");
  });

  it("returns 403 for non-owner", async () => {
    mockPrisma.trip.findUnique.mockResolvedValue({
      ...SAMPLE_TRIP,
      userId: OTHER_USER,
    });
    const req = mockRequest("http://localhost:3000/api/trips/trip-1", {
      method: "DELETE",
    });
    const res = await deleteTrip(req, makeContext("trip-1"));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Not authorized");
  });

  it("returns 401 without authentication", async () => {
    mockAuth.mockResolvedValue(null);
    const req = mockRequest("http://localhost:3000/api/trips/trip-1", {
      method: "DELETE",
    });
    const res = await deleteTrip(req, makeContext("trip-1"));
    expect(res.status).toBe(401);
  });
});
