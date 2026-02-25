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

// ─── Trips ────────────────────────────────────────────────

export const tripSchema = z.object({
  name: z.string().min(1, "Trip name is required"),
  startDate: z.string().datetime({ message: "Valid start date is required" }),
  endDate: z.string().datetime({ message: "Valid end date is required" }),
  status: z.enum(["planning", "active", "completed", "cancelled"]).default("planning"),
  notes: z.string().optional(),
  isPublic: z.boolean().default(false),
}).refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
  message: "End date must be on or after start date",
  path: ["endDate"],
});

export type TripInput = z.infer<typeof tripSchema>;

export const tripUpdateSchema = z.object({
  name: z.string().min(1, "Trip name is required").optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(["planning", "active", "completed", "cancelled"]).optional(),
  notes: z.string().nullable().optional(),
  isPublic: z.boolean().optional(),
}).refine((data) => {
  if (data.startDate && data.endDate) {
    return new Date(data.endDate) >= new Date(data.startDate);
  }
  return true;
}, {
  message: "End date must be on or after start date",
  path: ["endDate"],
});

export type TripUpdateInput = z.infer<typeof tripUpdateSchema>;

export const tripStopSchema = z.object({
  riverId: z.string().min(1, "River ID is required"),
  dayNumber: z.number().int().min(1, "Day number must be at least 1"),
  notes: z.string().optional(),
  putInTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format").optional(),
  takeOutTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be in HH:MM format").optional(),
  sortOrder: z.number().int().default(0),
});

export type TripStopInput = z.infer<typeof tripStopSchema>;

// ─── River Reviews ────────────────────────────────────────

export const reviewSchema = z.object({
  rating: z.number().int().min(1, "Rating must be at least 1").max(5, "Rating must be at most 5"),
  title: z.string().optional(),
  body: z.string().min(1, "Review body is required"),
  visitDate: z.string().datetime().optional(),
  difficulty: z.string().optional(),
});

export type ReviewInput = z.infer<typeof reviewSchema>;

// ─── River Photos ─────────────────────────────────────────

export const photoSchema = z.object({
  url: z.string().min(1, "Photo URL is required"),
  caption: z.string().max(500).optional(),
  takenAt: z.string().datetime().optional(),
});

export type PhotoInput = z.infer<typeof photoSchema>;

// ─── Auth: Password Reset ─────────────────────────────────

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
