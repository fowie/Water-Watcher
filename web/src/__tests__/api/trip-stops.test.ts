/**
 * Tests for the Trip Stops API.
 *
 * Routes:
 *   POST   /api/trips/:id/stops            — add a stop to a trip
 *   DELETE /api/trips/:id/stops/:stopId     — remove a stop
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  trip: {
    findUnique: vi.fn(),
  },
  river: {
    findUnique: vi.fn(),
  },
  tripStop: {
    create: vi.fn(),
    findUnique: vi.fn(),
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

import { POST as addStop } from "@/app/api/trips/[id]/stops/route";
import { DELETE as deleteStop } from "@/app/api/trips/[id]/stops/[stopId]/route";

function mockRequest(url: string, options: RequestInit = {}): Request {
  return new Request(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
}

const USER_ID = "user-1";
const OTHER_USER = "user-2";

const SAMPLE_TRIP = {
  id: "trip-1",
  name: "Colorado Trip",
  userId: USER_ID,
  status: "planning",
};

const SAMPLE_RIVER = {
  id: "river-1",
  name: "Colorado River",
  state: "CO",
  difficulty: "III",
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
  },
};

function makeStopContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeDeleteStopContext(id: string, stopId: string) {
  return { params: Promise.resolve({ id, stopId }) };
}

describe("POST /api/trips/:id/stops", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: USER_ID, email: "test@example.com" } });
  });

  it("adds a stop to a trip", async () => {
    mockPrisma.trip.findUnique.mockResolvedValue(SAMPLE_TRIP);
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.tripStop.create.mockResolvedValue(SAMPLE_STOP);
    const req = mockRequest("http://localhost:3000/api/trips/trip-1/stops", {
      method: "POST",
      body: JSON.stringify({ riverId: "river-1", dayNumber: 1 }),
    });
    const res = await addStop(req, makeStopContext("trip-1"));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.riverId).toBe("river-1");
    expect(data.river.name).toBe("Colorado River");
  });

  it("returns 400 when riverId is missing", async () => {
    const req = mockRequest("http://localhost:3000/api/trips/trip-1/stops", {
      method: "POST",
      body: JSON.stringify({ dayNumber: 1 }),
    });
    const res = await addStop(req, makeStopContext("trip-1"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid input");
  });

  it("returns 400 when dayNumber is invalid (0)", async () => {
    const req = mockRequest("http://localhost:3000/api/trips/trip-1/stops", {
      method: "POST",
      body: JSON.stringify({ riverId: "river-1", dayNumber: 0 }),
    });
    const res = await addStop(req, makeStopContext("trip-1"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid input");
  });

  it("returns 400 when dayNumber is negative", async () => {
    const req = mockRequest("http://localhost:3000/api/trips/trip-1/stops", {
      method: "POST",
      body: JSON.stringify({ riverId: "river-1", dayNumber: -1 }),
    });
    const res = await addStop(req, makeStopContext("trip-1"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when dayNumber is missing", async () => {
    const req = mockRequest("http://localhost:3000/api/trips/trip-1/stops", {
      method: "POST",
      body: JSON.stringify({ riverId: "river-1" }),
    });
    const res = await addStop(req, makeStopContext("trip-1"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when trip does not exist", async () => {
    mockPrisma.trip.findUnique.mockResolvedValue(null);
    const req = mockRequest("http://localhost:3000/api/trips/nope/stops", {
      method: "POST",
      body: JSON.stringify({ riverId: "river-1", dayNumber: 1 }),
    });
    const res = await addStop(req, makeStopContext("nope"));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Trip not found");
  });

  it("returns 404 when river does not exist", async () => {
    mockPrisma.trip.findUnique.mockResolvedValue(SAMPLE_TRIP);
    mockPrisma.river.findUnique.mockResolvedValue(null);
    const req = mockRequest("http://localhost:3000/api/trips/trip-1/stops", {
      method: "POST",
      body: JSON.stringify({ riverId: "nonexistent", dayNumber: 1 }),
    });
    const res = await addStop(req, makeStopContext("trip-1"));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("River not found");
  });

  it("returns 403 for non-owner", async () => {
    mockPrisma.trip.findUnique.mockResolvedValue({
      ...SAMPLE_TRIP,
      userId: OTHER_USER,
    });
    const req = mockRequest("http://localhost:3000/api/trips/trip-1/stops", {
      method: "POST",
      body: JSON.stringify({ riverId: "river-1", dayNumber: 1 }),
    });
    const res = await addStop(req, makeStopContext("trip-1"));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Not authorized");
  });

  it("returns 401 without authentication", async () => {
    mockAuth.mockResolvedValue(null);
    const req = mockRequest("http://localhost:3000/api/trips/trip-1/stops", {
      method: "POST",
      body: JSON.stringify({ riverId: "river-1", dayNumber: 1 }),
    });
    const res = await addStop(req, makeStopContext("trip-1"));
    expect(res.status).toBe(401);
  });

  it("accepts optional notes and time fields", async () => {
    mockPrisma.trip.findUnique.mockResolvedValue(SAMPLE_TRIP);
    mockPrisma.river.findUnique.mockResolvedValue(SAMPLE_RIVER);
    mockPrisma.tripStop.create.mockResolvedValue({
      ...SAMPLE_STOP,
      notes: "Meet at put-in",
      putInTime: "08:00",
      takeOutTime: "16:00",
    });
    const req = mockRequest("http://localhost:3000/api/trips/trip-1/stops", {
      method: "POST",
      body: JSON.stringify({
        riverId: "river-1",
        dayNumber: 1,
        notes: "Meet at put-in",
        putInTime: "08:00",
        takeOutTime: "16:00",
      }),
    });
    const res = await addStop(req, makeStopContext("trip-1"));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.notes).toBe("Meet at put-in");
    expect(data.putInTime).toBe("08:00");
  });

  it("returns 400 for invalid time format", async () => {
    const req = mockRequest("http://localhost:3000/api/trips/trip-1/stops", {
      method: "POST",
      body: JSON.stringify({
        riverId: "river-1",
        dayNumber: 1,
        putInTime: "8am",
      }),
    });
    const res = await addStop(req, makeStopContext("trip-1"));
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/trips/:id/stops/:stopId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: USER_ID, email: "test@example.com" } });
  });

  it("deletes a stop and returns 204", async () => {
    mockPrisma.trip.findUnique.mockResolvedValue(SAMPLE_TRIP);
    mockPrisma.tripStop.findUnique.mockResolvedValue({
      id: "stop-1",
      tripId: "trip-1",
    });
    mockPrisma.tripStop.delete.mockResolvedValue({});
    const req = mockRequest(
      "http://localhost:3000/api/trips/trip-1/stops/stop-1",
      { method: "DELETE" }
    );
    const res = await deleteStop(req, makeDeleteStopContext("trip-1", "stop-1"));
    expect(res.status).toBe(204);
    expect(mockPrisma.tripStop.delete).toHaveBeenCalledWith({
      where: { id: "stop-1" },
    });
  });

  it("returns 404 for non-existent stop", async () => {
    mockPrisma.trip.findUnique.mockResolvedValue(SAMPLE_TRIP);
    mockPrisma.tripStop.findUnique.mockResolvedValue(null);
    const req = mockRequest(
      "http://localhost:3000/api/trips/trip-1/stops/nope",
      { method: "DELETE" }
    );
    const res = await deleteStop(req, makeDeleteStopContext("trip-1", "nope"));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Trip stop not found");
  });

  it("returns 404 when stop belongs to a different trip", async () => {
    mockPrisma.trip.findUnique.mockResolvedValue(SAMPLE_TRIP);
    mockPrisma.tripStop.findUnique.mockResolvedValue({
      id: "stop-1",
      tripId: "other-trip",
    });
    const req = mockRequest(
      "http://localhost:3000/api/trips/trip-1/stops/stop-1",
      { method: "DELETE" }
    );
    const res = await deleteStop(req, makeDeleteStopContext("trip-1", "stop-1"));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Trip stop not found");
  });

  it("returns 404 when trip does not exist", async () => {
    mockPrisma.trip.findUnique.mockResolvedValue(null);
    const req = mockRequest(
      "http://localhost:3000/api/trips/nope/stops/stop-1",
      { method: "DELETE" }
    );
    const res = await deleteStop(req, makeDeleteStopContext("nope", "stop-1"));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Trip not found");
  });

  it("returns 403 for non-owner", async () => {
    mockPrisma.trip.findUnique.mockResolvedValue({
      ...SAMPLE_TRIP,
      userId: OTHER_USER,
    });
    const req = mockRequest(
      "http://localhost:3000/api/trips/trip-1/stops/stop-1",
      { method: "DELETE" }
    );
    const res = await deleteStop(req, makeDeleteStopContext("trip-1", "stop-1"));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Not authorized");
  });

  it("returns 401 without authentication", async () => {
    mockAuth.mockResolvedValue(null);
    const req = mockRequest(
      "http://localhost:3000/api/trips/trip-1/stops/stop-1",
      { method: "DELETE" }
    );
    const res = await deleteStop(req, makeDeleteStopContext("trip-1", "stop-1"));
    expect(res.status).toBe(401);
  });
});
