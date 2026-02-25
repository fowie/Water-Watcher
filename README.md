# Water-Watcher 🏞️

**Real-time whitewater conditions, hazard alerts, trip planning, and gear deals — all in one app.**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Tests](https://img.shields.io/badge/tests-1%2C304%20passing-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)
![Python](https://img.shields.io/badge/Python-3.12+-3776AB.svg)
![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)

Water-Watcher scrapes USGS, American Whitewater, BLM, USFS, Craigslist, and Facebook on a schedule, normalizes the data, and delivers push + email notifications when river conditions change or gear deals match your filters. The web UI provides a dashboard, interactive map, trip planner, river reviews, and more.

---

## Features

### 🌊 River Tracking
- Live flow rates, gauge heights, water temperature, and quality ratings
- Multi-source scraping with priority-based data merging (USGS > AW > BLM/USFS > Facebook)
- Runnability classification (optimal, runnable, too low, too high)
- Flow trend indicators (rising ↑, falling ↓, stable →)
- Hazard alerts: strainers, logjams, closures, permit requirements
- Rapid guides with difficulty ratings and run instructions
- Campsite info with amenities, permits, and Google Maps links

### 🗺️ Interactive Map
- Full-page Leaflet map with color-coded markers by condition quality
- Click markers for popup cards with river details
- Searchable river sidebar (desktop) / bottom sheet (mobile)
- Browser geolocation ("Locate Me" button)

### ☀️ Weather
- Open-Meteo integration (free, no API key)
- Current conditions: temperature, wind, precipitation
- 3-day forecast with weather icons
- Per-river weather tab on detail page

### 🏕️ Trip Planning
- Multi-day trip itineraries with day-by-day stops
- River picker for adding stops to each day
- Put-in/take-out time planning
- Status tracking: Planning → Active → Completed / Cancelled
- Public/private trip sharing via URL

### ⚡ Real-Time Updates
- Server-Sent Events (SSE) for live condition, hazard, and deal updates
- Auto-reconnect with exponential backoff
- No WebSocket needed — HTTP/2 native

### 🛒 Gear Deals
- Craigslist monitoring across configurable regions
- Scored deal matching (0–100) against custom filters
- Category, keyword, price, and region filters
- Price alert notifications

### 💬 Social
- River reviews with 1–5 star ratings
- One review per user per river (upsert pattern)
- Average ratings on river cards and detail pages
- Photo gallery with lightbox viewer
- Photo upload with 5MB client-side validation

### 🔍 Search
- Global search via Cmd/Ctrl+K command palette
- Searches across rivers, deals, trips, and reviews
- Recent searches stored locally
- Dedicated search results page with type filters

### 🔔 Notifications
- **Push**: Web Push API via service worker (pywebpush)
- **Email**: Resend API integration (deal, condition, hazard, weekly digest)
- Per-filter and per-river opt-in toggles
- Channel selector: Push / Email / Both
- Alert history page with type filtering
- Notification bell with unread count badge

### 🔐 Authentication
- NextAuth.js v5 with JWT strategy
- Google + GitHub OAuth providers
- Email/password with PBKDF2 hashing
- Password reset flow (email link)
- Email verification
- Protected routes via AuthGuard component

### 📦 Data Export
- Export tracked rivers, conditions, and deals
- Formats: JSON, CSV (RFC 4180), GPX (1.1 XML for GPS devices)
- User-scoped data only

### 📱 PWA
- Installable on mobile and desktop
- Offline page with retry button
- Service worker with cache-first (static) and network-first (API) strategies
- SVG icons for perfect scaling

### 📊 Admin
- Scrape monitor dashboard with per-source health status
- 24-hour stats: run count, success rate, items scraped
- Traffic light health indicators (green/yellow/red)
- Scrape history logs per source

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui (manual) |
| UI Components | Radix UI primitives + CVA variants |
| Database | PostgreSQL 16 |
| Web ORM | Prisma |
| Auth | NextAuth.js v5 (JWT + OAuth) |
| Maps | Leaflet (vanilla, no react-leaflet) |
| Weather | Open-Meteo (free API) |
| Email | Resend API |
| Scraping | Python 3.12 + httpx + BeautifulSoup4 + lxml |
| Pipeline ORM | SQLAlchemy 2.0 |
| Scheduling | APScheduler |
| Push Notifications | Web Push API (pywebpush) |
| Real-Time | Server-Sent Events (SSE) |
| Testing | Vitest (web) + pytest (pipeline) |
| Containerization | Docker + Docker Compose |
| CI | GitHub Actions (4 parallel jobs) |

---

## Quick Start

### Docker (Recommended)

```bash
# Clone the repo
git clone https://github.com/your-org/Water-Watcher.git
cd Water-Watcher

# Configure environment
cp .env.example .env
# Edit .env — defaults work for Docker

# Start all services
docker compose up -d

# Seed demo data
docker compose exec web npx tsx prisma/seed.ts

# Open http://localhost:3000
```

### Local Development

#### 1. Database

```bash
docker compose up postgres -d
```

#### 2. Web App

```bash
cd web
pnpm install
npx prisma db push
npx prisma generate
pnpm run db:seed
pnpm dev            # http://localhost:3000
```

#### 3. Scraping Pipeline

```bash
cd pipeline
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
python main.py
```

### Generate VAPID Keys

Push notifications require VAPID keys:

```bash
npx web-push generate-vapid-keys
```

Add the generated keys to your `.env` file.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Data Sources                       │
│  USGS · AW · BLM · USFS · Facebook · Craigslist     │
└──────────┬───────────────────────────────────────────┘
           │
┌──────────▼───────────────────────────────────────────┐
│              Python Pipeline (APScheduler)            │
│  Scrapers → Processors → Notifiers (Push + Email)    │
└──────────┬───────────────────────────────────────────┘
           │
┌──────────▼───────────────────────────────────────────┐
│              PostgreSQL 16                            │
│  Rivers · Conditions · Hazards · Deals · Users …     │
└──────────┬───────────────────────────────────────────┘
           │
┌──────────▼───────────────────────────────────────────┐
│              Next.js 15 Web App                       │
│  API Routes · SSE · React Frontend · Service Worker  │
└──────────────────────────────────────────────────────┘
```

- **Prisma** owns the database schema. SQLAlchemy models mirror it.
- Scrapers run on a schedule: river conditions every 4h, deals every 30min, land agencies every 6h.
- Condition data merged using source priority (USGS 100 > AW 80 > BLM/USFS 70 > Facebook 30).
- Deal matching uses scored evaluation (0–100) with 50-point notification threshold.

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/health` | No | Health check with DB probe |
| `GET` | `/api/rivers` | No | List rivers (paginated) |
| `POST` | `/api/rivers` | Yes | Create a river |
| `GET` | `/api/rivers/:id` | No | River detail (conditions, hazards, rapids, campsites) |
| `PATCH` | `/api/rivers/:id` | Yes | Update river fields |
| `DELETE` | `/api/rivers/:id` | Yes | Delete river (cascade) |
| `GET` | `/api/rivers/:id/reviews` | No | Paginated reviews + average rating |
| `POST` | `/api/rivers/:id/reviews` | Yes | Create/update review (upsert) |
| `GET` | `/api/rivers/:id/photos` | No | Paginated photo gallery |
| `POST` | `/api/rivers/:id/photos` | Yes | Upload photo |
| `DELETE` | `/api/rivers/:id/photos/:photoId` | Yes | Delete photo (owner only) |
| `GET` | `/api/deals` | No | List gear deals (filterable) |
| `GET` | `/api/deals/filters` | Yes | List user's deal filters |
| `POST` | `/api/deals/filters` | Yes | Create a deal filter |
| `GET` | `/api/deals/filters/:id` | Yes | Get a specific filter |
| `PATCH` | `/api/deals/filters/:id` | Yes | Update filter (ownership validated) |
| `DELETE` | `/api/deals/filters/:id` | Yes | Delete filter |
| `GET` | `/api/trips` | Yes | List user's trips |
| `POST` | `/api/trips` | Yes | Create a trip |
| `GET` | `/api/trips/:id` | Yes | Trip detail with stops |
| `PATCH` | `/api/trips/:id` | Yes | Update trip (status, dates, etc.) |
| `DELETE` | `/api/trips/:id` | Yes | Delete trip |
| `POST` | `/api/trips/:id/stops` | Yes | Add stop to trip |
| `DELETE` | `/api/trips/:id/stops/:stopId` | Yes | Remove stop from trip |
| `GET` | `/api/search` | Partial | Global search (trips require auth) |
| `GET` | `/api/export` | Yes | Export data (JSON, CSV, GPX) |
| `GET` | `/api/sse/rivers` | No | SSE stream for live updates |
| `GET` | `/api/alerts` | Yes | Alert history (paginated) |
| `GET` | `/api/user/profile` | Yes | User profile |
| `PATCH` | `/api/user/profile` | Yes | Update profile |
| `GET` | `/api/user/rivers` | Yes | Tracked rivers |
| `POST` | `/api/user/rivers` | Yes | Track a river |
| `DELETE` | `/api/user/rivers` | Yes | Untrack a river |
| `GET` | `/api/user/notifications` | Yes | Notification preferences |
| `PATCH` | `/api/user/notifications` | Yes | Update notification preferences |
| `POST` | `/api/notifications/subscribe` | Yes | Register push subscription |
| `POST` | `/api/auth/register` | No | Create account |
| `POST` | `/api/auth/forgot-password` | No | Request password reset email |
| `POST` | `/api/auth/reset-password` | No | Reset password with token |
| `GET` | `/api/auth/verify-email` | No | Verify email with token |
| `GET` | `/api/admin/scrapers` | Yes | Scraper summary stats |
| `GET` | `/api/admin/scrapers/:source` | Yes | Per-source scrape logs |

---

## Testing

**Total: 1,304 tests** (668 web + 636 pipeline)

### Web (Vitest)

```bash
cd web
pnpm test              # run once
pnpm test:watch        # watch mode
pnpm test:coverage     # with coverage
```

### Pipeline (pytest)

```bash
cd pipeline
pip install -r requirements-dev.txt
pytest tests/ -v
```

---

## Project Structure

```
Water-Watcher/
├── web/                        # Next.js 15 web application
│   ├── prisma/
│   │   ├── schema.prisma       # Database schema (canonical)
│   │   └── seed.ts             # Demo data seeder
│   ├── public/
│   │   ├── icons/              # PWA SVG icons
│   │   ├── manifest.json       # PWA manifest
│   │   ├── sw.js               # Service worker
│   │   └── offline.html        # Offline fallback page
│   └── src/
│       ├── app/
│       │   ├── admin/          # Scrape monitor dashboard
│       │   ├── alerts/         # Alert history
│       │   ├── auth/           # Sign-in, register, forgot/reset password, verify email
│       │   ├── deals/          # Gear deals grid + filters
│       │   ├── export/         # Data export page
│       │   ├── map/            # Interactive Leaflet map
│       │   ├── profile/        # User profile
│       │   ├── rivers/         # River list, detail, compare, favorites
│       │   ├── search/         # Search results page
│       │   ├── settings/       # User settings
│       │   ├── stats/          # Stats dashboard
│       │   ├── trips/          # Trip planner
│       │   └── api/            # 35+ API route handlers
│       ├── components/         # React components (UI + domain)
│       ├── hooks/              # Custom React hooks (useToast, etc.)
│       ├── lib/                # Utilities, API client, validations, auth
│       └── types/              # TypeScript type definitions
├── pipeline/                   # Python scraping pipeline
│   ├── scrapers/               # USGS, AW, BLM, USFS, Craigslist, Facebook
│   ├── processors/             # Condition processor, deal matcher
│   ├── notifiers/              # Push + email notification dispatch
│   ├── models/                 # SQLAlchemy models (mirrors Prisma)
│   ├── config/                 # Pipeline settings
│   └── tests/                  # pytest test suite (636 tests)
├── docker-compose.yml          # 4-service config (postgres, migrate, web, pipeline)
├── .env.example                # Environment variable template
└── .github/workflows/ci.yml   # GitHub Actions (4 parallel jobs)
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Public base URL |
| `NEXTAUTH_SECRET` | Yes | — | NextAuth.js JWT secret |
| `NEXTAUTH_URL` | Yes | — | NextAuth.js base URL |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No | — | VAPID public key for push |
| `VAPID_PRIVATE_KEY` | No | — | VAPID private key for push |
| `VAPID_SUBJECT` | No | — | VAPID subject (mailto: URL) |
| `RESEND_API_KEY` | No | — | Resend API key for email notifications |
| `NOTIFICATION_FROM_EMAIL` | No | `alerts@waterwatcher.app` | Email sender address |
| `GOOGLE_CLIENT_ID` | No | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | — | Google OAuth client secret |
| `GITHUB_ID` | No | — | GitHub OAuth client ID |
| `GITHUB_SECRET` | No | — | GitHub OAuth client secret |
| `FACEBOOK_ACCESS_TOKEN` | No | — | Facebook access token |
| `CRAIGSLIST_REGIONS` | No | `seattle,portland,...` | Craigslist regions to scrape |
| `USGS_BASE_URL` | No | USGS default | USGS Water Services URL |
| `AW_BASE_URL` | No | AW default | American Whitewater URL |
| `BLM_BASE_URL` | No | BLM default | BLM recreation API URL |
| `RIDB_API_KEY` | No | — | USFS RIDB API key |
| `SCRAPE_INTERVAL_MINUTES` | No | `60` | River scrape interval |
| `RAFT_WATCH_INTERVAL_MINUTES` | No | `15` | Deal scrape interval |
| `LAND_AGENCY_INTERVAL_MINUTES` | No | `360` | BLM/USFS scrape interval |

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Run tests before committing (`pnpm test` in web, `pytest` in pipeline)
4. Commit with descriptive messages
5. Open a pull request against `main`

---

## License

MIT
