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

export const riverUpdateSchema = z.object({
  name: z.string().min(1, "River name is required").optional(),
  state: z.string().min(1, "State is required").optional(),
  region: z.string().nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  difficulty: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
});

export type RiverUpdateInput = z.infer<typeof riverUpdateSchema>;

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

export const dealFilterUpdateSchema = z.object({
  name: z.string().min(1, "Filter name is required").optional(),
  keywords: z.array(z.string()).min(1, "At least one keyword is required").optional(),
  categories: z.array(z.string()).optional(),
  maxPrice: z.number().positive().nullable().optional(),
  regions: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export type DealFilterUpdateInput = z.infer<typeof dealFilterUpdateSchema>;

// ─── Push Subscription ───────────────────────────────────

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
