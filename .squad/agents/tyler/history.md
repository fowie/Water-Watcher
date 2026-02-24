# Tyler — History

## Core Context
- **Project:** Water-Watcher — Whitewater Rafting Tracker
- **User:** Spencer Fowers
- **Stack:** Next.js 15 App Router + TypeScript, Tailwind CSS v4, Prisma, Radix UI primitives
- **Key UI surfaces:** River dashboard, river detail (tabbed: conditions/hazards/rapids/campsites), deals grid with filters, responsive navigation
- **Design goal:** Mobile-first responsive, easy to use on the river or at home

## Learnings

**2026-02-24:** Built out the full frontend UI from scaffold placeholders. Key decisions and files:

### UI Primitives (shadcn-style, manually created)
- `web/src/components/ui/` — Button, Card, Input, Badge, Dialog, Tabs, Label, Textarea, Switch, Select, Separator
- Used CSS variables for theming (light/dark) throughout all components
- Radix UI primitives installed: @radix-ui/react-{slot,dialog,tabs,dropdown-menu,toast,label,separator,switch,select,popover}
- CVA (class-variance-authority) for variant-based component styling

### Custom Components
- `river-card.tsx` — Card for rivers grid with condition display, hazard count, relative timestamps
- `deal-card.tsx` — Card for gear deals with image, price badge, location, external link
- `condition-badge.tsx` — Color-coded quality indicator (excellent=green, good=blue, etc.)
- `hazard-badge.tsx` — Severity-colored hazard type badge
- `rapid-rating.tsx` — Difficulty class badge with color coding (Class I through V+)
- `add-river-dialog.tsx` — Form dialog for adding new rivers with validation
- `create-filter-dialog.tsx` — Form dialog for creating deal alerts with keyword/category/price/region fields
- `notification-toggle.tsx` — Switch with bell icon for per-river notifications
- `navigation.tsx` — Responsive nav: sidebar on desktop, header+bottom tab bar on mobile, slide-out sheet menu

### Pages
- `page.tsx` (home) — Hero with branding, CTA buttons, feature cards
- `rivers/page.tsx` — Client-side search, card grid, debounced search, empty states
- `rivers/[id]/page.tsx` — Tabbed detail page: Conditions, Hazards, Rapids, Campsites with stat cards header
- `deals/page.tsx` — Grid with filter panel (category/price/region), saved alerts with enable/disable toggles

### Data Fetching
- `web/src/lib/api.ts` — Typed fetch wrapper for all API endpoints (getRivers, getRiver, getDeals, getDealFilters, createRiver, createDealFilter, subscribePush)
- Client components fetch via useEffect + useCallback for proper re-render control
- Debounced search on rivers page (300ms timeout)

### Styling Decisions
- CSS custom properties for all theme tokens (not Tailwind config)
- `globals.css` includes Radix animation keyframes
- Dark mode via `prefers-color-scheme` media query on CSS variables
- Mobile-first with Tailwind responsive breakpoints (sm:, md:, lg:, xl:)
- Desktop: 264px fixed sidebar, content offset with md:pl-64
- Mobile: 56px top header + 64px bottom tab bar, content offset with pt-14 pb-20

---

## Cross-Agent Updates

**2026-02-24 (from Utah):** All 5 API routes enhanced with real Prisma queries, error handling, and input validation. Rivers GET now returns `{ rivers, total, limit, offset }` (paginated). Deals GET supports `search` text filter. Deal filters POST and notifications POST validate user existence before saving. River detail returns 20 conditions. SQLAlchemy models now include User and UserRiver — if you add columns/tables to Prisma schema, notify Utah to mirror in `pipeline/models/models.py`.

**2026-02-24 (from Pappas):** 98 TypeScript tests written and passing (Vitest). Covers all API routes, Zod validations, and utility functions. Tests in `web/src/__tests__/`. Key pattern: `vi.hoisted()` required for Prisma mock setup. Response shapes validated (e.g., rivers returns `{ rivers, total, limit, offset }`, not bare array).

**2026-02-24:** UI polish pass — added reusable components for empty states, loading skeletons, and toast notifications:

### New Components
- `web/src/components/empty-state.tsx` — Reusable `EmptyState` with icon, title, description, optional children. Used on both rivers and deals pages.
- `web/src/components/ui/skeleton.tsx` — CSS `animate-pulse` skeleton primitive for loading placeholders.
- `web/src/components/ui/toast.tsx` — Radix Toast primitives with default/destructive/success variants.
- `web/src/hooks/use-toast.ts` — `useToast` hook with global state pattern (listeners + dispatch). `toast()` function can be called from anywhere.
- `web/src/components/toaster.tsx` — `Toaster` client component wired into root layout.

### Patterns
- Loading states now show card-shaped skeleton grids (6 cards for rivers, 8 for deals) instead of a single spinner.
- EmptyState is a shared component — accepts `icon`, `title`, `description` props. Previous inline EmptyState/EmptyDeals functions removed.
- Toast system uses module-level state with listener pattern so `toast()` can be called outside React trees.
- Navigation active route detection verified correct: exact match for "/", prefix match for "/rivers" and "/deals".

**2026-02-24:** River detail page enhancements for practical rafter UX:

### New Utilities & Components
- `timeAgo(dateString)` added to `web/src/lib/utils.ts` — converts ISO dates to human-friendly relative times ("2 hours ago", "3 days ago", etc.)
- `web/src/components/flow-trend.tsx` — `FlowTrend` component showing trend arrow (↑ rising, ↓ falling, → stable) by comparing most recent two flow rate readings. Thresholds: >10% change = rising/falling, ≤10% = stable.

### River Detail Page Updates (`web/src/app/rivers/[id]/page.tsx`)
- Condition timestamps now show relative time via `timeAgo()` instead of raw `toLocaleString()`
- Hazard report dates now show relative time via `timeAgo()` instead of `toLocaleDateString()`
- Flow Rate stat card shows `FlowTrend` arrow next to the CFS value
- `StatCard` component extended with optional `extra` prop for inline supplementary content
- Campsite names now have a small external link icon next to them (linking to Google Maps) when lat/lng available
- Google Maps URLs updated to canonical `https://www.google.com/maps?q=` format

### RapidRating Color Updates (`web/src/components/rapid-rating.tsx`)
- Class II changed from blue to green, matching the rafter convention: I-II = green, III = yellow, IV = orange, V+ = red

**2026-02-24:** Three feature improvements — dashboard homepage, river delete, dark mode toggle:

### Dashboard Homepage (`web/src/app/page.tsx`)
- Replaced static hero/marketing page with a functional dashboard (client component)
- Quick stats row: total rivers, active hazards, recent deals count, active deal filters — fetched via `Promise.allSettled` for resilient loading
- "Recent Conditions" section shows last 5 rivers from API
- "Latest Deals" section shows 3 most recent gear deals
- Loading skeletons for all sections while data fetches
- Empty states with links to add rivers / browse deals

### River Card Delete (`web/src/components/river-card.tsx`)
- Added `onDelete?: () => void` callback prop to `RiverCardProps`
- Trash2 icon button appears on hover in top-right corner (absolute positioned, z-10)
- Click handler: `e.preventDefault()` + `e.stopPropagation()` to prevent Link navigation
- `window.confirm()` before calling `deleteRiver(id)` from api.ts
- Destructive hover color on the trash button for clear affordance

### Delete River API Client (`web/src/lib/api.ts`)
- Added `deleteRiver(id: string): Promise<void>` — calls `DELETE /api/rivers/{id}`
- Fixed `getRivers` to properly handle paginated response `{ rivers, total, limit, offset }` — was incorrectly treating response as a bare array
- Added `RiversResponse` export interface with `rivers`, `total`, `limit`, `offset`
- Added `limit` and `offset` params to `getRivers`
- Updated `web/src/app/rivers/page.tsx` to destructure `.rivers` from new response shape

### Dark Mode Toggle (`web/src/components/theme-toggle.tsx`)
- `ThemeToggle` component: Sun/Moon icons from lucide-react
- Toggles `dark` class on `<html>` element
- Persists preference in `localStorage` under key `"theme"`
- SSR-safe: renders placeholder div until mounted to avoid hydration mismatch
- Respects `prefers-color-scheme` on first load if no stored preference
- Added to desktop sidebar footer and mobile top header bar in `navigation.tsx`
- CSS: `html.dark { ... }` block in `globals.css` mirrors existing `@media (prefers-color-scheme: dark)` variables

**2026-02-24:** Settings page, edit river dialog, MapLink component, and accessibility improvements:

### Settings Page (`web/src/app/settings/page.tsx`)
- Three sections: Notification Preferences, Data Management, About
- Notification Preferences: fetches deal filters via `getDealFilters`, shows toggle switches per filter with active count badge, updates via `updateDealFilter` API
- Data Management: "Check Connection" button (calls `/api/health`), "Clear Cache" button (clears localStorage except theme)
- About: shows "Water-Watcher v0.1.0" badge, GitHub link
- Added Settings to `navItems` in `navigation.tsx` (uses `Settings` icon from lucide-react)
- Route layout `web/src/app/settings/layout.tsx` exports metadata `{ title: "Settings" }`

### Edit River Dialog (`web/src/components/edit-river-dialog.tsx`)
- Pre-fills form with current `RiverDetail` data via `defaultValue` props
- Validates with `riverUpdateSchema` from `web/src/lib/validations.ts` (safeParse)
- Calls `updateRiver(id, data)` from `web/src/lib/api.ts` (PATCH `/api/rivers/[id]`)
- Toast notifications on success/error via `useToast` hook
- Added to river detail page header next to notification toggle
- River detail page refactored: data loading moved to `loadRiver` callback so edit dialog can trigger refresh

### MapLink Component (`web/src/components/map-link.tsx`)
- Props: `latitude`, `longitude`, `label`, `showLabel`, `className`
- Generates Google Maps URL: `https://www.google.com/maps?q={lat},{lng}`
- Uses `MapPin` icon from lucide-react
- Includes `aria-label` with descriptive text
- Replaced inline Google Maps `<a>` tags in river detail campsites tab
- Added to river detail header when river has coordinates

### Accessibility Improvements
- **Skip-to-content link**: Added in `web/src/app/layout.tsx`, uses `sr-only` with `focus:not-sr-only` for keyboard users
- **`aria-label` on icon buttons**: ThemeToggle, delete button on RiverCard, menu button/close button on mobile nav, deal card "View" link
- **`aria-hidden="true"` on decorative icons**: All lucide icons in buttons/links marked as decorative
- **`role` attributes**: Notification toggle group has `role="group"`, main content wrapper has `role="main"`
- **`aria-expanded`**: Mobile menu button reflects sheet open state
- **`aria-label` on nav elements**: Desktop sidebar `<nav>`, mobile sheet `<nav>`, bottom tab bar `<nav>` all have `aria-label`
- **Page-level titles**: Root layout uses `title.template` pattern (`"%s | Water-Watcher"`). Route layouts for `/rivers`, `/deals`, `/settings` export metadata titles
- **Keyboard focus**: Delete button on RiverCard now shows on `focus:opacity-100` (not just hover)
- **`sr-only` labels**: Filter toggle switches on settings page have screen-reader-only labels

**2026-02-24 (Round 4 cross-agent — from Utah):** Created `api-errors.ts` utility (apiError + handleApiError), `GET /api/health` endpoint (DB check, ok/degraded), `PATCH /api/rivers/[id]` (partial updates), `PATCH /api/deals/filters/[id]` (ownership-validated updates). 168 web tests passing.

**2026-02-24 (Round 4 cross-agent — from Pappas):** Added 51 new web tests (148 → 199) covering api-errors, health, PATCH rivers, PATCH deal filters. Total: 477 tests. Dashboard component testing blocked on missing @testing-library/react.

**2026-02-24 (Round 4 cross-agent — from Coordinator):** Fixed `timeAgo` bugs — added "weeks ago" bucket for 7-27 days, graceful fallback for invalid date inputs.