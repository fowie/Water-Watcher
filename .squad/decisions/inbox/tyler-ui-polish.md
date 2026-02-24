# FE-005: Shared EmptyState + Skeleton + Toast Components
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

## Context
Rivers and deals pages had inline empty-state components and basic spinner loading states. No toast/notification system existed for user feedback.

## Decisions
1. **EmptyState** — Single reusable component (`empty-state.tsx`) with `icon`, `title`, `description`, `children` props. Replaces per-page inline versions.
2. **Skeleton** — CSS `animate-pulse` primitive in `ui/skeleton.tsx`. Loading states now render card-shaped skeleton grids matching the actual layout (6 river cards, 8 deal cards).
3. **Toast** — Radix Toast in `ui/toast.tsx` + `useToast` hook in `hooks/use-toast.ts`. Uses module-level state with listener pattern so `toast()` can be called from any component. `Toaster` wired into root layout. Three variants: default, destructive, success.
4. **Navigation** — Mobile bottom nav active-route detection reviewed and confirmed correct (exact match for `/`, prefix for sub-routes).
