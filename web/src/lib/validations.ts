import { z } from "zod";

// ─── Rivers ───────────────────────────────────────────────

export const riverSchema = z.object({
  name: z.string().min(1, "River name is required"),
  state: z.string().min(1, "State is required"),
  region: z.string().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  difficulty: z.string().optional(),
  description: z.string().optional(),
  awId: z.string().optional(),
  usgsGaugeId: z.string().optional(),
});

export type RiverInput = z.infer<typeof riverSchema>;

// ─── Deal Filters ─────────────────────────────────────────

export const dealFilterSchema = z.object({
  name: z.string().min(1, "Filter name is required"),
  keywords: z.array(z.string()).min(1, "At least one keyword is required"),
  categories: z.array(z.string()).default([]),
  maxPrice: z.number().positive().optional(),
  regions: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
});

export type DealFilterInput = z.infer<typeof dealFilterSchema>;

// ─── Push Subscription ───────────────────────────────────

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
