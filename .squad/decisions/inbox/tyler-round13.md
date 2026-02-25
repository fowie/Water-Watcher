# Tyler — Round 13 Decisions

## FE-016: Admin User Management Pattern
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Admin user management page at `/admin/users` uses a client-side admin role check (reads `session.user.role`) rather than middleware-level gating. This matches the existing `AuthGuard` component pattern and keeps the admin check visible in the component tree. The role dropdown uses a native `<select>` element styled as a pill badge rather than a Radix Select, because role changes are a simple two-option choice (user/admin) and native selects have better accessibility out of the box.

Users cannot change their own role to prevent accidental self-demotion. The API consumer (`PATCH /api/admin/users/[id]`) is expected to enforce server-side authorization as well.

**Key files:** `web/src/app/admin/users/page.tsx`, `web/src/lib/api.ts` (getAdminUsers, updateAdminUserRole)

## FE-017: Keyboard Shortcuts Overlay Component
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Created `KeyboardShortcuts` component that renders a full-screen overlay listing all available keyboard shortcuts. Triggered by pressing `?` anywhere in the app (except when focused on inputs/textareas/selects). The component is mounted at the Navigation level alongside SearchPalette, keeping global keyboard features colocated. Uses the same visual pattern as SearchPalette (fixed overlay with backdrop, rounded card content).

**Key file:** `web/src/components/keyboard-shortcuts.tsx`

## FE-018: Accessibility Standards Applied
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Comprehensive accessibility audit applied across all components:
- All icon-only buttons have `aria-label`
- All decorative icons have `aria-hidden="true"`
- Active nav links use `aria-current="page"` per WAI-ARIA best practices
- Toast viewport has `aria-live="polite"` for screen reader announcements
- All expandable elements (user menu, notification bell, mobile menu) have `aria-expanded`
- All dropdowns close on Escape key press
- Search palette has focus trap to prevent tabbing out while open
- Badge color contrast verified against WCAG AA (4.5:1 minimum for normal text)
