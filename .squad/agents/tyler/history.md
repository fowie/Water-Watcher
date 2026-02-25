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

**2026-02-24:** Error boundaries, 404 pages, loading states, river search improvements, and metadata:

### Error Boundaries & 404 Pages
- `web/src/app/not-found.tsx` — Global 404 with water-themed emoji art (mountain + kayak), Card-based centered layout, link back to dashboard
- `web/src/app/error.tsx` — "use client" global error boundary with AlertTriangle icon, Try Again (calls `reset()`), and Back to Dashboard link
- `web/src/app/rivers/[id]/error.tsx` — River-specific error boundary: "Couldn't load river" with Try Again and Back to Rivers
- `web/src/app/rivers/[id]/not-found.tsx` — "River not found" with desert emoji and link to rivers list

### Loading States (Next.js file-convention skeletons)
- `web/src/app/loading.tsx` — Global loading: header skeleton + 6-card grid
- `web/src/app/rivers/loading.tsx` — River list loading: header + search bar + 6-card grid skeletons
- `web/src/app/rivers/[id]/loading.tsx` — River detail loading: breadcrumb + header + 4 stat cards + tabs + content skeletons
- `web/src/app/deals/loading.tsx` — Deals loading: header + filter bar + 8-card grid with image placeholder skeletons
- All use existing `Skeleton` component from `ui/skeleton.tsx`

### River Search Improvements (`web/src/app/rivers/page.tsx`)
- Difficulty filter chips: Class I through V+ buttons using the same color scheme as `RapidRating`. Toggle on/off, multi-select. Active state uses solid background. All client-side filtering on already-fetched data.
- Sort by dropdown (Radix Select): Name A–Z, Recently Updated, Most Hazards. Default: Name A–Z.
- `useMemo` for filtering + sorting pipeline to avoid re-computation
- "Clear" button appears when filters or non-default sort active

### Metadata & Favicon (`web/src/app/layout.tsx`)
- Added Open Graph tags: title, description, siteName, type, locale
- Added Twitter card metadata
- Emoji favicon via SVG data URL trick (🏞️ landscape emoji)
- `metadataBase` set from `NEXT_PUBLIC_BASE_URL` env var with localhost fallback

**2026-02-24 (Round 5 cross-agent — from Utah):** Docker multi-service setup (web + pipeline Dockerfiles, 4-service compose), GitHub Actions CI (4 parallel jobs), comprehensive README rewrite, .env.example updates.

**2026-02-24 (Round 5 cross-agent — from Pappas):** 166 new tests (pipeline 278→407, web 199→236, total 643). Found 3 bugs in pipeline; all fixed by Coordinator.

**2026-02-24 (Round 5 cross-agent — from Coordinator):** Fixed USGS error handling, _find_river name fallback, classify_runnability inclusive bound. Updated 4 tests.

**2026-02-24:** Auth UI implementation — sign-in, registration, user menu, protected routes:

### Auth Pages
- `web/src/app/auth/signin/page.tsx` — Centered card layout with Water-Watcher branding, email + password fields, error display, link to register. Uses `signIn("credentials", { redirect: false })` from `next-auth/react` and checks result for errors before redirecting.
- `web/src/app/auth/register/page.tsx` — Name + email + password + confirm password with Zod validation (`registerFormSchema`). Calls POST `/api/auth/register`, then auto-signs-in on success. Per-field error display + server error banner.
- `web/src/app/auth/layout.tsx` — Metadata layout for auth pages (title: "Authentication").

### Session & Auth Components
- `web/src/components/session-provider.tsx` — Client component wrapper for NextAuth `SessionProvider`, added to root `layout.tsx` wrapping the entire app.
- `web/src/components/user-menu.tsx` — Two exports: `UserMenuDesktop` (sidebar bottom, dropdown with Settings/Sign Out) and `UserMenuMobile` (compact avatar in top header). Uses `useSession()` for auth state. Shows "Sign In" button when unauthenticated.
- `web/src/components/auth-guard.tsx` — `AuthGuard` client component. Shows skeleton loading state, redirects to `/auth/signin?callbackUrl=...` when unauthenticated. Wraps protected pages.

### Navigation Updates (`web/src/components/navigation.tsx`)
- Split nav items into `publicNavItems` (Home, Rivers, Deals) and `authNavItems` (Settings). Settings only shown when authenticated via `useSession()`.
- Desktop sidebar: User menu positioned between nav links and footer tagline.
- Mobile header: User avatar/sign-in button added next to theme toggle.

### Protected Routes
- Settings page wrapped in `AuthGuard` — redirects to sign-in if not logged in.
- Replaced `DEMO_USER_ID` with `session.user.id` from `useSession()` in settings page.

### Architecture Decisions
- Updated `auth.ts` pages config: `signIn: "/auth/signin"` (was "/login").
- Auth pages use full-screen centered layout (no navigation chrome) for clean sign-in/register UX.
- `AuthGuard` uses client-side redirect pattern (not middleware) — simpler, works with SessionProvider, shows loading skeleton during check.

**2026-02-24 (Round 6 cross-agent — from Utah):** Implemented NextAuth.js v5 with Credentials provider, JWT strategy, PBKDF2 hashing. `withAuth()` middleware injects `x-user-id` header. Registration endpoint at `POST /api/auth/register`. Route protection: public GET reads, auth-required writes, ownership-enforced deal filters (403 on mismatch). Key files: `auth.ts`, `auth-utils.ts`, `api-middleware.ts`.

**2026-02-24 (Round 6 cross-agent — from Pappas):** 61 new auth tests covering registration (23), auth utils (23), and withAuth middleware (15). PBKDF2 produces 32-char hex salt + 128-char hex hash. Registration uses `.safeParse()` so validation errors return `{ error, details }` shape. Web test count: 236 → 300.

**2026-02-24:** User profile page, river comparison view, favorites/tracked rivers, and navigation updates:

### User Profile Page (`web/src/app/profile/page.tsx`)
- AuthGuard-protected profile page at `/profile`
- Profile card: avatar/initials, name, email, member since date
- Inline editing: name + email fields with save/cancel, calls `PATCH /api/user/profile`
- Session is refreshed after profile edit so nav reflects updated name
- Stats section: rivers tracked count, deal filters active count (from existing API)
- Member-since badge using `timeAgo()` utility
- Layout with metadata title "Profile"

### River Comparison View (`web/src/app/rivers/compare/page.tsx`)
- Side-by-side comparison of 2-3 rivers
- State managed via URL query params (`?rivers=id1,id2,id3`) for shareable links
- Desktop: HTML table with metric rows (Quality, Flow Rate, Water Temp, Gauge Height, Difficulty, Hazards, Runnability)
- Mobile: stacked cards with stat rows
- Visual "Best" badges on highest values; "Safest" badge on fewest hazards
- `Promise.allSettled` for resilient loading — shows whatever rivers succeed
- Empty state with back-to-rivers link when no IDs provided

### Compare Mode on Rivers Page (`web/src/app/rivers/page.tsx`)
- "Compare" button in header enters selection mode
- Selection mode: cards show checkbox, clicking selects (no navigation)
- Max 3 rivers selectable; toast warning when exceeding
- "Compare (N)" button navigates to `/rivers/compare?rivers=...`
- "Cancel" button exits compare mode and clears selection

### Favorites / Tracked Rivers (`web/src/app/rivers/favorites/page.tsx`)
- AuthGuard-protected favorites page at `/rivers/favorites`
- Shows user's tracked rivers via `GET /api/user/rivers`
- Rivers can be untracked inline via the star button on each card
- Empty state with guidance to star rivers from the main rivers page

### Tracked Rivers API (`web/src/app/api/user/rivers/route.ts`)
- `GET /api/user/rivers` — returns user's tracked rivers with latest conditions, hazard counts, tracker counts
- `POST /api/user/rivers` — add river to tracking (body: `{ riverId }`), validates river exists, returns 409 if already tracked
- `DELETE /api/user/rivers?riverId=xxx` — remove from tracking, returns 204
- All routes wrapped in `withAuth()` for authentication

### API Client Updates (`web/src/lib/api.ts`)
- Added `getTrackedRivers()`, `trackRiver(riverId)`, `untrackRiver(riverId)` functions
- Added `TrackedRiver` and `TrackedRiversResponse` interfaces

### River Card Enhancements (`web/src/components/river-card.tsx`)
- Added `isFavorited`, `onToggleFavorite` props — star icon button appears on hover (always visible when favorited, filled yellow)
- Added `selectable`, `selected`, `onSelect` props — checkbox UI for compare mode
- In selection mode, clicking the card calls `onSelect` instead of navigating
- Keyboard accessible: `role="button"`, `tabIndex`, Enter/Space key handling

### Navigation Updates (`web/src/components/navigation.tsx`)
- Added "My Rivers" to `authNavItems` (Star icon, `/rivers/favorites`), shows only when authenticated
- Appears in desktop sidebar, mobile sheet, and bottom tab bar

### User Menu Updates (`web/src/components/user-menu.tsx`)
- Added "Profile" link to desktop dropdown (User icon, `/profile`), appears above Settings
- Mobile avatar now links to `/profile` instead of `/settings`

### Rivers Page Tracking Integration (`web/src/app/rivers/page.tsx`)
- Fetches tracked river IDs on mount (authenticated users only)
- Star button on each river card toggles tracking via `POST`/`DELETE /api/user/rivers`
- Toast notifications on track/untrack success and failure
- Tracking state managed as `Set<string>` of river IDs

**2026-02-24 (Round 7 cross-agent — from Utah):** Created BLM + USFS scrapers on 6-hour schedule (`run_land_agency_scrapers()`). BLM scraper: recreation API + RSS feed, advisory classification. USFS scraper: RIDB API with key gating. Created `GET/PATCH /api/user/profile` with `withAuth()`, duplicate-email check, riverCount/filterCount. New settings: `BLM_BASE_URL`, `RIDB_API_KEY`, `LAND_AGENCY_INTERVAL_MINUTES`.

**2026-02-24 (Round 7 cross-agent — from Pappas):** 204 new tests covering all Round 7 features. User profile tests (22): GET/PATCH, validation, auth. User rivers tests (23): GET/POST/DELETE, duplicates, auth. BLM (88) and USFS (71) scraper tests. Total: 954 tests.

**2026-02-24:** OAuth sign-in buttons, notification preferences UI, alert history page, and notification bell:

### OAuth Sign-In Buttons (`web/src/app/auth/signin/page.tsx`, `web/src/app/auth/register/page.tsx`)
- Added "Continue with Google" (white bg, Google logo SVG) and "Continue with GitHub" (dark bg, GitHub logo SVG) buttons
- Full-width, placed above the email/password form
- Visual "or" divider separator between OAuth and credentials sections
- Google button uses `signIn("google", { callbackUrl })`, GitHub uses `signIn("github", { callbackUrl })`
- Same OAuth buttons added to registration page

### Notification Preferences Section (`web/src/app/settings/page.tsx`)
- New `GlobalNotificationPreferences` component added between existing deal filter toggles and Data Management
- Channel selector: Push / Email / Both — radio group style buttons with icons (Smartphone, Mail, Bell)
- Toggle switches for: Deal Alerts, Condition Alerts, Hazard Alerts, Weekly Digest — each with description text
- Save button enabled only when changes are detected (dirty checking against fetched state)
- Fetches current preferences via `GET /api/user/notifications` on mount
- Saves via `PATCH /api/user/notifications`
- Toast notifications on save success/error

### Alert History Page (`web/src/app/alerts/page.tsx`)
- Protected route at `/alerts` wrapped in `AuthGuard`
- Filter tabs: All, Deals, Conditions, Hazards — pill-style toggle buttons
- Alert cards show: type icon (emoji badge with colored background), title, body, timestamp via `timeAgo()`
- Type badges: Deal (blue/ShoppingBag), Condition (green/Droplets), Hazard (red/AlertTriangle), Digest (purple/Bell)
- Paginated with "Load More" button showing remaining count
- Empty state with appropriate messaging per filter
- Layout file exports metadata `{ title: "Alerts" }`

### Notification Bell Component (`web/src/components/notification-bell.tsx`)
- Bell icon with unread count badge (red dot with number, "99+" for >99)
- Clicking opens dropdown with 5 most recent alerts
- Each alert shows type emoji, title, truncated body, relative timestamp
- "View All Alerts" link to `/alerts`
- Polls every 60 seconds for updates
- Placed in desktop sidebar (above user menu) and mobile top header (before user menu)
- Only renders when authenticated via `useSession()`
- Close on outside click via `mousedown` listener

### Navigation Updates (`web/src/components/navigation.tsx`)
- Added "Alerts" to `authNavItems` list (Bell icon, `/alerts`)
- `NotificationBell` added to desktop sidebar and mobile header
- Component index updated to export `NotificationBell`

### API Client (`web/src/lib/api.ts`)
- Confirmed existing functions: `getNotificationPreferences()`, `updateNotificationPreferences()`, `getAlerts()`
- `NotificationPreferences` and `AlertLogRecord` interfaces already present from prior round

**2026-02-24 (Round 8 cross-agent — from Utah):** Built `EmailNotifier` using Resend API with 4 methods (deal, condition, hazard, digest). Created `NotificationPreference` and `AlertLog` models in Prisma + SQLAlchemy. Notification prefs API (`GET/PATCH /api/user/notifications`) with auto-create defaults. Alert history API (`GET /api/alerts`) with pagination and type filter. Added Google + GitHub OAuth providers to NextAuth. SQLAlchemy gotcha: `metadata` is reserved, used `extra_data` attribute mapped to `metadata` column.

**2026-02-24 (Round 8 cross-agent — from Pappas):** 116 new tests: email notifier (70), notification prefs (22), alerts (24). Pipeline 636+43skip, Web 387, total 1023+43. Found `limit=0` treated as falsy in alerts route.

**2026-02-24 (Round 8 cross-agent — from Coordinator):** Fixed alerts API `limit=0` edge case — `Number.isFinite` instead of `||` fallback.