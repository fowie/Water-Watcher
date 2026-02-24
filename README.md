# Water-Watcher

**Whitewater rafting condition tracker and gear deal monitor.**

Track river conditions in real time, get hazard alerts, browse rapid guides and campsites, and never miss a deal on rafting gear. Water-Watcher scrapes multiple data sources on a schedule and delivers push notifications when conditions change or gear deals match your filters.

## Features

- **River Dashboard** - Live flow rates, gauge heights, water temps, and quality ratings
- **Multi-Source Scraping** - USGS, American Whitewater, Craigslist, with priority-based data merging
- **Raft Watch** - Craigslist gear deal monitor with scored matching against custom filters
- **Hazard Alerts** - Strainers, logjams, closures, permit requirements
- **Rapid Guides** - Difficulty ratings and run instructions per rapid
- **Campsite Info** - Locations, amenities, permit requirements
- **Push Notifications** - Opt-in alerts for condition changes and deal matches
- **Dark Mode** - System-aware theme with manual toggle
- **Responsive UI** - Desktop sidebar + mobile bottom tab bar

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | PostgreSQL 16 |
| Web ORM | Prisma |
| Scraping | Python 3.12 + httpx + BeautifulSoup4 |
| Pipeline ORM | SQLAlchemy 2.0 |
| Scheduling | APScheduler |
| Notifications | Web Push API (pywebpush) |
| Testing | Vitest (web) + pytest (pipeline) |
| Containerization | Docker + Docker Compose |

## Screenshots

> _Screenshots coming soon. Run the app locally to see the UI._

## Getting Started

### Prerequisites

- [Node.js 20+](https://nodejs.org/) with pnpm
- [Python 3.12+](https://www.python.org/)
- [Docker](https://www.docker.com/) and Docker Compose
- (Optional) VAPID keys for push notifications

### Quick Start (Docker)

```bash
# Clone the repo
git clone https://github.com/your-org/Water-Watcher.git
cd Water-Watcher

# Configure environment
cp .env.example .env
# Edit .env - the defaults work for local Docker

# Start all services
docker compose up -d

# Seed demo data
docker compose exec web npx tsx prisma/seed.ts

# Open http://localhost:3000
```

### Local Development

#### 1. Start the database

```bash
docker compose up postgres -d
```

#### 2. Set up the web app

```bash
cd web
pnpm install
npx prisma db push
npx prisma generate
pnpm run db:seed    # seed demo data
pnpm dev            # http://localhost:3000
```

#### 3. Set up the scraping pipeline

```bash
cd pipeline
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

### Generate VAPID Keys

Push notifications require VAPID keys. Generate them and add to `.env`:

```bash
npx web-push generate-vapid-keys
```

## Project Structure

```
Water-Watcher/
├── web/                    # Next.js 15 web application
│   ├── src/
│   │   ├── app/            # App Router pages & API routes
│   │   ├── components/     # React components (UI + domain)
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utilities, DB client, validations
│   │   └── types/          # TypeScript type definitions
│   ├── prisma/             # Schema, migrations, seed script
│   └── public/             # Static assets + service worker
├── pipeline/               # Python scraping pipeline
│   ├── scrapers/           # Per-source scraper modules
│   ├── processors/         # Data normalization & matching
│   ├── notifiers/          # Push notification dispatch
│   ├── models/             # SQLAlchemy models
│   ├── config/             # Pipeline settings
│   └── tests/              # pytest test suite
├── docker-compose.yml      # Full multi-service config
└── .env.example            # Environment variable template
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check with DB connectivity probe |
| `GET` | `/api/rivers` | List rivers (paginated: `limit`, `offset`) |
| `POST` | `/api/rivers` | Create a new river |
| `GET` | `/api/rivers/:id` | River detail with conditions, hazards, rapids, campsites |
| `PATCH` | `/api/rivers/:id` | Update river fields |
| `DELETE` | `/api/rivers/:id` | Delete river (cascades to all child records) |
| `GET` | `/api/deals` | List gear deals (filter: `category`, `search`, `maxPrice`) |
| `GET` | `/api/deals/filters` | List deal filters for a user |
| `POST` | `/api/deals/filters` | Create a deal filter |
| `GET` | `/api/deals/filters/:id` | Get a specific deal filter |
| `PATCH` | `/api/deals/filters/:id` | Update a deal filter (ownership validated) |
| `DELETE` | `/api/deals/filters/:id` | Delete a deal filter |
| `POST` | `/api/notifications/subscribe` | Register a push subscription |

## Testing

### Web (Vitest)

```bash
cd web
pnpm test              # run once
pnpm test:watch        # watch mode
pnpm test:coverage     # with coverage report
```

### Pipeline (pytest)

```bash
cd pipeline
pip install -r requirements-dev.txt
pytest tests/ -v
```

## Architecture

```
[USGS / AW / Craigslist]
        |
   Python Scrapers
        |
   Processors (normalize, score, merge)
        |
   PostgreSQL
        |
   Next.js API Routes
        |
   React Frontend <-> Push Notifications
```

- **Prisma** owns the database schema. SQLAlchemy models mirror it.
- Scrapers run on a schedule via APScheduler (river conditions every 4h, deals every 30m).
- Condition data is merged using a source priority system (USGS > AW > BLM > Facebook).
- Deal matching uses scored evaluation (0-100) with configurable thresholds.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Run tests before committing (`pnpm test` in web, `pytest` in pipeline)
4. Commit with descriptive messages
5. Open a pull request against `main`

## License

MIT
