/**
 * Tests for Zod validation schemas.
 *
 * Covers valid inputs, invalid inputs, edge cases, and type coercion
 * for all three schemas: riverSchema, dealFilterSchema, pushSubscriptionSchema.
 */

import { describe, it, expect } from "vitest";
import {
  riverSchema,
  dealFilterSchema,
  pushSubscriptionSchema,
} from "@/lib/validations";

// ─── riverSchema ──────────────────────────────────────────

describe("riverSchema", () => {
  it("accepts valid minimal input", () => {
    const result = riverSchema.safeParse({
      name: "Colorado River",
      state: "CO",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid full input", () => {
    const result = riverSchema.safeParse({
      name: "Middle Fork Salmon",
      state: "ID",
      region: "Frank Church Wilderness",
      latitude: 45.1234,
      longitude: -114.5678,
      difficulty: "Class IV",
      description: "Premier multi-day wilderness run",
      awId: "aw-1234",
      usgsGaugeId: "13309220",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = riverSchema.safeParse({ state: "CO" });
    expect(result.success).toBe(false);
  });

  it("rejects missing state", () => {
    const result = riverSchema.safeParse({ name: "Colorado River" });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = riverSchema.safeParse({ name: "", state: "CO" });
    expect(result.success).toBe(false);
  });

  it("rejects empty state", () => {
    const result = riverSchema.safeParse({ name: "Colorado River", state: "" });
    expect(result.success).toBe(false);
  });

  it("accepts unicode in river name", () => {
    const result = riverSchema.safeParse({
      name: "Río Grande — Taos Box",
      state: "NM",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Río Grande — Taos Box");
    }
  });

  it("rejects latitude out of range", () => {
    const result = riverSchema.safeParse({
      name: "Test River",
      state: "CO",
      latitude: 91,
    });
    expect(result.success).toBe(false);
  });

  it("rejects latitude below -90", () => {
    const result = riverSchema.safeParse({
      name: "Test River",
      state: "CO",
      latitude: -91,
    });
    expect(result.success).toBe(false);
  });

  it("rejects longitude out of range", () => {
    const result = riverSchema.safeParse({
      name: "Test River",
      state: "CO",
      longitude: 181,
    });
    expect(result.success).toBe(false);
  });

  it("rejects longitude below -180", () => {
    const result = riverSchema.safeParse({
      name: "Test River",
      state: "CO",
      longitude: -181,
    });
    expect(result.success).toBe(false);
  });

  it("accepts boundary latitude values", () => {
    const r1 = riverSchema.safeParse({ name: "R", state: "S", latitude: 90 });
    const r2 = riverSchema.safeParse({ name: "R", state: "S", latitude: -90 });
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });

  it("accepts boundary longitude values", () => {
    const r1 = riverSchema.safeParse({ name: "R", state: "S", longitude: 180 });
    const r2 = riverSchema.safeParse({ name: "R", state: "S", longitude: -180 });
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });

  it("strips extra fields", () => {
    const result = riverSchema.safeParse({
      name: "Test",
      state: "CO",
      extraField: "should be ignored",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>)["extraField"]).toBeUndefined();
    }
  });
});

// ─── dealFilterSchema ─────────────────────────────────────

describe("dealFilterSchema", () => {
  it("accepts valid minimal input", () => {
    const result = dealFilterSchema.safeParse({
      name: "Raft deals",
      keywords: ["raft"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid full input", () => {
    const result = dealFilterSchema.safeParse({
      name: "Cheap rafts in PNW",
      keywords: ["raft", "inflatable", "nrs"],
      categories: ["raft", "kayak"],
      maxPrice: 1500,
      regions: ["seattle", "portland"],
      isActive: true,
    });
    expect(result.success).toBe(true);
  });

  it("provides defaults for optional arrays", () => {
    const result = dealFilterSchema.safeParse({
      name: "Test filter",
      keywords: ["kayak"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.categories).toEqual([]);
      expect(result.data.regions).toEqual([]);
      expect(result.data.isActive).toBe(true);
    }
  });

  it("rejects missing name", () => {
    const result = dealFilterSchema.safeParse({ keywords: ["raft"] });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", () => {
    const result = dealFilterSchema.safeParse({ name: "", keywords: ["raft"] });
    expect(result.success).toBe(false);
  });

  it("rejects missing keywords", () => {
    const result = dealFilterSchema.safeParse({ name: "Test" });
    expect(result.success).toBe(false);
  });

  it("rejects empty keywords array", () => {
    const result = dealFilterSchema.safeParse({
      name: "Test",
      keywords: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative maxPrice", () => {
    const result = dealFilterSchema.safeParse({
      name: "Test",
      keywords: ["raft"],
      maxPrice: -100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero maxPrice", () => {
    const result = dealFilterSchema.safeParse({
      name: "Test",
      keywords: ["raft"],
      maxPrice: 0,
    });
    expect(result.success).toBe(false);
  });

  it("accepts large maxPrice", () => {
    const result = dealFilterSchema.safeParse({
      name: "Expensive finds",
      keywords: ["sotar"],
      maxPrice: 50000,
    });
    expect(result.success).toBe(true);
  });

  it("allows isActive to be false", () => {
    const result = dealFilterSchema.safeParse({
      name: "Inactive filter",
      keywords: ["raft"],
      isActive: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(false);
    }
  });
});

// ─── pushSubscriptionSchema ──────────────────────────────

describe("pushSubscriptionSchema", () => {
  it("accepts valid subscription", () => {
    const result = pushSubscriptionSchema.safeParse({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
      keys: {
        p256dh: "BIG_BASE64_ENCODED_KEY",
        auth: "SHORT_AUTH_SECRET",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing endpoint", () => {
    const result = pushSubscriptionSchema.safeParse({
      keys: { p256dh: "key", auth: "auth" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-URL endpoint", () => {
    const result = pushSubscriptionSchema.safeParse({
      endpoint: "not-a-url",
      keys: { p256dh: "key", auth: "auth" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing keys", () => {
    const result = pushSubscriptionSchema.safeParse({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing p256dh key", () => {
    const result = pushSubscriptionSchema.safeParse({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
      keys: { auth: "auth" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing auth key", () => {
    const result = pushSubscriptionSchema.safeParse({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
      keys: { p256dh: "key" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty object", () => {
    const result = pushSubscriptionSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
