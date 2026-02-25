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

**2026-02-24:** Round 9 — Interactive Map, Weather Widget, Data Export UI:

### Interactive Map Page (`web/src/app/map/page.tsx`)
- Full-page map view using vanilla Leaflet (dynamically imported via `import()` to avoid SSR `window` issues)
- `useRef` + `useEffect` pattern for Leaflet initialization — no react-leaflet dependency (avoids App Router SSR conflicts)
- Color-coded markers by condition quality: green (excellent/good), yellow (fair), orange (poor), red (dangerous), gray (unknown)
- Click marker → popup card with river name, state, quality badge, difficulty, flow rate, and "View Details" link
- Desktop: right sidebar (320px) listing all rivers with search filter, click to zoom + open popup
- Mobile: bottom sheet with drag handle, collapse/expand toggle, same filtered river list
- Search box filters rivers by name, state, or difficulty
- "Locate me" button using browser Geolocation API
- Legend card showing condition color codes
- Leaflet CSS loaded from CDN (`unpkg.com/leaflet@1.9.4`)
- Added `MapIcon` (as `Map`) + `Download` to lucide imports in navigation
- Added "Map" to `publicNavItems` in `navigation.tsx`
- Layout + loading.tsx created for the route

### Weather Widget (`web/src/components/weather-widget.tsx`)
- Takes `latitude` and `longitude` props
- Fetches from Open-Meteo API (free, no API key needed)
- Displays current: temperature (°F), weather description, wind speed (mph), precipitation (mm)
- 3-day forecast as small cards with weather icons, high/low temps, precipitation
- Weather code → lucide-react icon mapping (Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, CloudFog)
- Celsius → Fahrenheit and km/h → mph conversions
- Loading skeleton while fetching
- Graceful fallback: "No location data" with MapPin icon when river has no lat/lng
- Error fallback: "Weather data unavailable" message
- Added as a new "Weather" tab (CloudSun icon) in the river detail page tabs (grid-cols-4 → grid-cols-5)
- Exported from `web/src/components/index.ts`

### Data Export Page (`web/src/app/export/page.tsx`)
- Protected by `AuthGuard`
- Format selector: JSON (FileJson icon), CSV (FileSpreadsheet icon), GPX (Map icon) — card-based radio buttons with descriptions
- Type selector: Rivers, Conditions, Deals, All — card-based radio buttons
- GPX auto-disabled (grayed out with info message) when type is not "Rivers"; auto-switches to JSON if user changes type away from Rivers while GPX selected
- Estimated record count shown based on API totals (~20 conditions per river estimate)
- Export button calls `GET /api/export?format={f}&type={t}` and triggers browser file download with timestamped filename
- Toast notifications on success/error
- Added `exportData(format, type)` to `web/src/lib/api.ts`
- Added "Export" to `authNavItems` in navigation (Download icon, only visible when authenticated)
- Layout + loading.tsx created for the route

### Navigation Updates (`web/src/components/navigation.tsx`)
- `publicNavItems`: added Map (MapIcon, `/map`)
- `authNavItems`: added Export (Download icon, `/export`) between Alerts and Settings
- Both appear in desktop sidebar, mobile sheet, and bottom tab bar

### Dependencies
- Installed `leaflet` + `@types/leaflet` via npm
- No react-leaflet — using vanilla Leaflet with refs to avoid Next.js App Router SSR issues

**2026-02-24 (Round 9 cross-agent — from Utah):** Built SSE endpoint (`GET /api/sse/rivers`) with `ReadableStream`, 30-second DB polling, three event types (condition-update, hazard-alert, deal-match), retry:5000 auto-reconnect. Created `useRiverSSE` React hook with exponential backoff (1s–30s). Updated PWA manifest + layout meta tags. Enhanced service worker with cache-first/network-first strategies and cache versioning. Built data export API (`GET /api/export`) — JSON, CSV (RFC 4180), GPX (1.1 XML) with Zod validation and `withAuth()`. Key files: `web/src/app/api/sse/rivers/route.ts`, `web/src/lib/sse.ts`, `web/src/app/api/export/route.ts`, `web/public/sw.js`, `web/public/manifest.json`.

**2026-02-24 (Round 9 cross-agent — from Pappas):** 98 new tests (web 387→485, total 1,164). SSE tests (19), export tests (41), SSE client + weather tests (38). Found 3 bugs — all fixed by Coordinator: SSE deal-match userId leak removed, SSE cancel() cleanup added, GPX validation moved before data fetch. Observation: CSV `#` section headers are non-standard.

**2026-02-24 (Round 9 cross-agent — from Coordinator):** Fixed 3 bugs: removed userId from SSE deal-match events, added clearInterval in cancel() callback, moved GPX type validation before fetchExportData().

**2026-02-24:** Round 10 — Trip Planner, River Reviews UI, Admin Stats Dashboard:

### Trip Planner Page (`web/src/app/trips/page.tsx`)
- AuthGuard-protected trip listing page at `/trips`
- Filter tabs: All, Upcoming, Past, Cancelled — pill-style toggle buttons with client-side filtering
- Search input for filtering trips by name
- "New Trip" button opens create dialog with name, date range, notes, public toggle
- Trip cards (`web/src/components/trip-card.tsx`) show name, date range, day count, stop count, status badge
- Status badges color-coded: planning=blue, active=green, completed=gray, cancelled=red
- Empty state with CTA to create first trip
- Layout + loading.tsx created

### Trip Detail Page (`web/src/app/trips/[id]/page.tsx`)
- Breadcrumb navigation back to trip list
- Editable name/dates/notes (inline edit mode with Save/Cancel)
- Day-by-day itinerary: cards for each day in the trip date range
- Each day card shows stops in sort order with timeline indicators (dot + line)
- Each stop shows: river name (linked), difficulty badge, state, put-in/take-out times, notes
- "Add River" button per day opens `RiverPickerDialog` to search and select rivers
- Remove stop button (X icon) with confirm dialog, visible on hover
- Status change buttons: Start Trip (planning→active), Complete (active→completed), Cancel
- Share button copies trip URL to clipboard (visible when trip is public)
- Delete trip button with confirm

### River Picker Dialog (`web/src/components/river-picker-dialog.tsx`)
- Dialog/modal for selecting a river to add to a trip stop
- Search input with 300ms debounce, fetches from `GET /api/rivers`
- Shows river name, state, difficulty badge per result
- Click selects and closes dialog
- Loading and empty states

### River Reviews UI
- `web/src/components/river-reviews.tsx` — Reviews display component
  - Average rating as filled/half/empty star icons (`StarRating` component)
  - Review count text with rating number
  - Sort buttons: Most Recent, Highest, Lowest
  - Individual review cards: user avatar/name, star rating, title, body, visit date, perceived difficulty badge, relative timestamp
  - Write Review button (auth-only)
  - Empty state with CTA to write first review
- `web/src/components/review-form.tsx` — Review form dialog
  - Star rating selector with hover preview (1-5 stars)
  - Title input (optional), body textarea (required)
  - Visit date picker, difficulty selector dropdown (Class I–V+)
  - Submit button with loading state, success toast
  - Pre-fill support for editing existing reviews
- Added "Reviews" tab to river detail page (`web/src/app/rivers/[id]/page.tsx`)
  - Tab grid expanded from 5 to 6 columns (MessageSquare icon)
  - Average rating displayed in river header area
  - Loads review summary (avg rating + count) alongside river data via `Promise.all`

### Stats Dashboard (`web/src/app/stats/page.tsx`)
- AuthGuard-protected stats page at `/stats`
- Summary cards row: Total Rivers, Active Hazards, Total Deals, Your Trips, Rivers Tracked
- Condition Quality Breakdown: CSS conic-gradient donut chart with color-coded legend (excellent=green, good=blue, fair=yellow, poor=orange, dangerous=red, unknown=gray)
- Recent Activity feed: last 10 alerts with type icons, titles, and relative timestamps
- Your Stats section: rivers tracked, trips planned, deal filters, total rivers
- All data fetched via `Promise.allSettled` for resilient loading
- Layout + loading.tsx created

### Navigation Updates (`web/src/components/navigation.tsx`)
- Added "Trips" (Compass icon, `/trips`) and "Stats" (BarChart3 icon, `/stats`) to `authNavItems`
- Both appear in desktop sidebar, mobile sheet, and bottom tab bar (auth-only)
- Placed between My Rivers and Alerts in the nav order

### Component Index Updates
- Exported: `TripCard`, `RiverPickerDialog`, `RiverReviews`, `StarRating`, `ReviewForm`

**2026-02-24 (Round 10 cross-agent — from Utah):** Built Trip Planner API with `Trip` + `TripStop` models: 7 endpoints (`GET/POST /api/trips`, `GET/PATCH/DELETE /api/trips/:id`, `POST /api/trips/:id/stops`, `DELETE /api/trips/:id/stops/:stopId`). Status workflow: planning → active → completed (or cancelled). River Reviews API with `@@unique([riverId, userId])` upsert pattern, paginated GET with `averageRating`. Rate limiting middleware (`rate-limit.ts`) — in-memory token bucket, `withRateLimit()` HOF composable with `withAuth()`. Applied to auth register (5/min) and review POST (10/min). All models mirrored in SQLAlchemy.

**2026-02-24 (Round 10 cross-agent — from Pappas):** 87 new web tests (485→572): trips (30), trip stops (17), reviews (20), rate limiting (20). Grand total 1,251. Found `tripUpdateSchema` missing `endDate >= startDate` refinement. Also observed reviews GET has no sort parameter.

**2026-02-24 (Round 10 cross-agent — from Coordinator):** Fixed `tripUpdateSchema` date refinement bug — added `.refine()` for `endDate >= startDate` on PATCH when both fields present.

**2026-02-24:** Round 11 — Global Search with Command Palette, River Photo Gallery, Scrape Monitor Dashboard:

### Global Search — Command Palette (`web/src/components/search-palette.tsx`)
- Full-screen overlay triggered by Cmd/Ctrl+K (global keyboard shortcut via `keydown` listener)
- Also triggered by search icon button added to navigation (desktop sidebar header + mobile top header)
- Search input at top with dimmed background, ESC to close
- 300ms debounced input calling `GET /api/search?q={query}&limit=8`
- Results grouped by type (Rivers, Deals, Trips, Reviews) with lucide icons per group and uppercase section headers
- Arrow keys navigate results, Enter selects, Escape closes
- Selected result highlighted with primary color, shows CornerDownLeft hint icon
- Recent searches stored in localStorage (last 5) via `RECENT_SEARCHES_KEY`
- Empty state: "Type to search rivers, deals, trips, and reviews..."
- Footer shows result count and "View all results" link to `/search` page

### Global Search — Full Page (`web/src/app/search/page.tsx`)
- Full search results page at `/search?q=term&type=rivers`
- URL reflects search params; persists across page loads
- Type filter tabs: All | Rivers | Deals | Trips | Reviews (pill-style toggle buttons)
- Results as cards with type icon, title, subtitle, type badge, external link indicator
- Grid layout: 2 columns on desktop, 1 on mobile
- Empty states for no results and pre-search
- Suspense boundary wrapping `useSearchParams()` to avoid Next.js build warnings
- Layout + loading.tsx created for the route

### Navigation Search Updates (`web/src/components/navigation.tsx`)
- Added `Search` and `Activity` icons from lucide-react
- Desktop sidebar: search icon button in brand header area, shows ⌘K tooltip
- Mobile header: search icon button before notification bell
- `SearchPalette` mounted at Navigation level, state lifted via `onSearchOpen` callbacks
- `DesktopNav` and `MobileNav` now accept `onSearchOpen` prop

### River Photo Gallery (`web/src/components/photo-gallery.tsx`)
- Grid layout: 3 columns desktop, 2 mobile
- Click photo → lightbox overlay with dark background
- Lightbox: arrow key navigation, X to close, caption overlay, photo counter
- Photo count badge at top
- Intersection observer lazy loading with sentinel div for infinite scroll
- Loading state with spinner, empty state with camera icon
- Lightbox locks body scroll while open

### Photo Upload (`web/src/components/photo-upload.tsx`)
- "Add Photo" button visible only when authenticated (via `useSession()`)
- Dialog with: file input (jpg/png/webp), base64 data URL preview, caption input, date picker
- Max file size check: 5MB with error message
- Preview with remove button (X icon overlay)
- Upload progress state with Loader2 spinner
- After upload: toast success, refresh gallery via `onUploadComplete` callback
- Reset state on dialog close

### River Detail Updates (`web/src/app/rivers/[id]/page.tsx`)
- Added "Photos" tab (Camera icon) as 6th tab (grid-cols-6 → grid-cols-7)
- Tab label shows count: "Photos (5)" when photos exist
- Photo count fetched alongside river data
- `photoRefreshKey` state triggers re-fetch after upload
- `PhotoGallery` and `PhotoUpload` imported and wired up

### Scrape Monitor Dashboard (`web/src/app/admin/scrapers/page.tsx`)
- Protected by `AuthGuard`
- System stats row: Total Rivers, Conditions (24h), Active Hazards, Sources — card-based summary
- One scraper card per source (USGS, American Whitewater, Craigslist, BLM, USFS)
- Each card shows: emoji + name, status dot (green/yellow/red based on interval), last scrape (timeAgo), 24h stats (runs, success rate %, items scraped)
- Status color logic: green (<2x interval), yellow (2-3x), red (>3x or never)
- Click card → expand detailed view with stats row + scrape history table
- Scrape history: status icon (CheckCircle2/XCircle), timestamp, status badge, items count, duration, error message (truncated with title tooltip)
- Paginated to show last 50 entries, scrollable container (max-h-64)
- Added "Scrapers" (Activity icon) to `authNavItems` in navigation, between Export and Settings
- Layout + loading.tsx created for the route

### Component Index Updates
- Exported: `SearchPalette`, `PhotoGallery`, `PhotoUpload`

### Build
- `npx next build` passes cleanly, all routes compiled
- Admin scrapers page renders as dynamic route (ƒ)
- Search page and river detail properly compile


**2026-02-24 (Round 11 cross-agent — from Utah):** Built Global Search API (`GET /api/search`) with Prisma `contains` case-insensitive matching across rivers, deals, trips, reviews. Auth-aware: trips scoped to user, silently omitted for anonymous `type=all`, 401 for explicit `type=trips`. Results grouped by type. River Photo Gallery: `RiverPhoto` model, paginated public GET, auth+rate-limited POST (max 20 per user per river), owner-only DELETE. Scrape Monitoring API at `GET /api/admin/scrapers` (per-source 24h stats) and `GET /api/admin/scrapers/:source` (last 50 logs, success rate). Both auth-required. Key files: `web/src/app/api/search/route.ts`, `web/src/app/api/rivers/[id]/photos/route.ts`, `web/src/app/api/admin/scrapers/route.ts`.

**2026-02-24 (Round 11 cross-agent — from Pappas):** 96 new web tests (572→668): search (32), river photos (31), scrapers (33). Grand total 1,347. No bugs found. Observations: search `type=all` silently skips trips for anonymous users, scraper VALID_SOURCES is case-sensitive, photo POST rate limit runs before auth.

**2026-02-24:** Round 12 — Password Reset & Email Verification UI, README Overhaul, PWA Icons & Offline Page, Seed Script Update:

### Password Reset & Email Verification UI

#### Forgot Password Page (`web/src/app/auth/forgot-password/page.tsx`)
- Email input form with "Send Reset Link" button → calls `POST /api/auth/forgot-password` via `forgotPassword()` from api.ts
- Success state: green CheckCircle2 icon, "Check your email for a reset link" message
- Error handling with toast + inline error banner
- Link back to sign-in (ArrowLeft icon)
- Same auth layout pattern: full-screen centered card, no navigation chrome

#### Reset Password Page (`web/src/app/auth/reset-password/page.tsx`)
- Reads `token` from query params via `useSearchParams()` — Suspense boundary wrapping the form component
- New password + confirm password inputs with Zod validation (min 8 chars, passwords match)
- Password strength indicator: 5-segment bar scoring length (8+, 12+), uppercase, number, special char
- Strength labels: Weak (red), Fair (orange), Good (yellow), Strong (green)
- Inline requirement checklist (✓/✗ for 8+ chars, uppercase, number)
- "Reset Password" button → calls `POST /api/auth/reset-password` via `resetPassword()` from api.ts
- Success → redirect to sign-in with toast "Password reset successfully"
- Invalid/expired token → error message with "Request a New Link" button linking to `/auth/forgot-password`
- Missing token → immediate error state (no form shown)

#### Email Verification Page (`web/src/app/auth/verify-email/page.tsx`)
- Reads `token` from query params via `useSearchParams()` — Suspense boundary
- Auto-calls `GET /api/auth/verify-email?token=xxx` on mount via `useEffect` + `useCallback`
- Three states: loading (Loader2 spinner), success (CheckCircle2), error (AlertCircle)
- Success: "Email Verified!" message → auto-redirect to sign-in after 3 seconds
- Error: "Verification Failed" with "Go to Sign In" button
- Fallback link "Click here if you're not redirected"

#### Sign-In Page Update (`web/src/app/auth/signin/page.tsx`)
- Added "Forgot password?" link between the password Label and Input — uses flex `justify-between` layout
- Links to `/auth/forgot-password`

### Comprehensive README Update (`README.md`)
- Complete rewrite reflecting all features from Rounds 1–12
- Hero section with app name, tagline, and badges (license, test count, TypeScript, Python, Next.js)
- Features organized into 13 categories with emoji headers: River Tracking, Interactive Map, Weather, Trip Planning, Real-Time Updates, Gear Deals, Social, Search, Notifications, Authentication, Data Export, PWA, Admin
- Tech stack table expanded to 17 rows including Auth, Maps, Weather, Email, Real-Time, CI
- Quick Start with Docker (primary) and Local Dev (secondary) instructions
- ASCII architecture diagram showing 4-layer flow: Data Sources → Pipeline → PostgreSQL → Next.js
- Complete API reference table with 37 endpoints including auth status (Yes/No/Partial)
- Testing section with total count (1,304) and commands for both web and pipeline
- Updated project structure tree reflecting all directories and key files
- Environment variables table with 22 entries, required/optional status, and defaults
- Contributing guide and MIT license

### PWA Icons & Offline Page

#### SVG Icons
- `web/public/icons/icon-192x192.svg` — Water drop + mountain design on sky-blue circular background; uses SVG linear gradients for sky, mountain, snow cap, and water drop
- `web/public/icons/icon-512x512.svg` — Same design at 512px viewport; identical visual with scaled coordinates
- Both are SVG so they scale perfectly to any resolution

#### Manifest Update (`web/public/manifest.json`)
- Updated icon paths from `/icon-192.png` and `/icon-512.png` to `/icons/icon-192x192.svg` and `/icons/icon-512x512.svg`
- Changed `type` from `image/png` to `image/svg+xml`

#### Offline Page (`web/public/offline.html`)
- Static HTML with inline CSS (no external dependencies needed offline)
- Dark theme (#0f172a background) matching app design
- Water-Watcher wave brand icon + "You're Offline" heading
- Message: "Check your internet connection and try again"
- "Try Again" button calls `window.location.reload()`
- Decorative wave SVG at page bottom
- WiFi-off icon as main visual

#### Service Worker Update (`web/public/sw.js`)
- Added `/offline.html` to `PRECACHE_ASSETS` array — cached during install event
- Updated icon paths in PRECACHE_ASSETS to match new `/icons/` directory
- Updated push notification icon references from `/icon-192.png` to `/icons/icon-192x192.svg`
- Existing navigation fetch handler already returns `offline.html` for failed navigation requests via `caches.match(OFFLINE_URL)`

### Seed Script Update (`web/prisma/seed.ts`)
- Added sample Trip: "Gore Canyon Weekend" — 3-day planning status trip, public, starting 2 weeks from seed time
- Added 3 TripStops: Day 1 Gore Canyon, Day 2 Browns Canyon, Day 3 Browns Canyon (with notes, put-in/take-out times)
- Added 3 RiverReviews: 5-star Gore Canyon ("World-class canyon run"), 4-star Browns Canyon ("Great family-friendly run"), 5-star Main Salmon ("Bucket-list wilderness trip")
- Trip uses upsert pattern with stable `id: "demo-trip"` for idempotent re-runs
- TripStops use deleteMany + createMany pattern (consistent with hazards/campsites/rapids)
- Reviews use upsert on `riverId_userId` unique constraint (consistent with Prisma model's `@@unique`)
- All new seed data references existing demo user and demo rivers

### Build
- `npx next build` passes cleanly — all new auth routes compile as static pages
- No TypeScript errors

**2026-02-24 (Round 12 cross-agent — from Utah):** Fixed Docker Compose — replaced `db-migrate` full web build with lightweight `node:20-alpine` + volume-mounted Prisma schema. Added all missing env vars to docker-compose.yml. Made Playwright optional in pipeline Dockerfile. Built Facebook scraper with Graph API + public page dual strategy, condition extraction, river mention regex, 48-hour window. Password reset: `PasswordResetToken` model, `POST /api/auth/forgot-password` (anti-enumeration 200), `POST /api/auth/reset-password` (token + PBKDF2), `GET /api/auth/verify-email` (redirect). Created `web/src/lib/email.ts` (Resend, no-op without key). Security headers in `next.config.ts` (HSTS, X-Frame-Options, Permissions-Policy). Key files: `pipeline/scrapers/facebook.py`, `web/src/app/api/auth/forgot-password/route.ts`, `web/src/app/api/auth/reset-password/route.ts`, `web/src/app/api/auth/verify-email/route.ts`, `web/src/lib/email.ts`.

**2026-02-24 (Round 12 cross-agent — from Pappas):** Replaced all 43 skipped Facebook scraper stubs with 110 real tests. Created `auth-password-reset.test.ts` (26), `email.test.ts` (19), `security-headers.test.ts` (9). Pipeline 746 passed, 0 skipped. Web 722. Grand total 1,468 with zero skipped. Email tests use `vi.resetModules()` for module re-import. Security headers tested via config import.
