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