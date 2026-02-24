# 🌊 Water-Watcher — Whitewater Rafting Tracker

A web app for tracking whitewater rafting conditions across rivers. Scrapes multiple data sources for rafting quality, hazards, timing, campsites, and rapid-running guidance. Includes **Raft Watch** — a Craigslist gear deal monitor with filters and notifications.

## Data Sources

- **American Whitewater** — river conditions, flow data, rapid guides
- **BLM / National Forest Service** — permits, closures, campsite info
- **Facebook groups** — community reports, local conditions
- **USGS Water Services** — real-time gauge/flow data
- **Craigslist** — rafting gear deals (Raft Watch)

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | Next.js 15 (App Router) + TypeScript | Full-stack framework, SSR, API routes |
| **Styling** | Tailwind CSS + shadcn/ui | Rapid, responsive UI development |
| **Database** | PostgreSQL | Concurrent access from web + pipeline |
| **Web ORM** | Prisma | Type-safe DB access from Next.js |
| **Scraping** | Python 3.11+ | Best scraping ecosystem (BS4, Playwright) |
| **Pipeline ORM** | SQLAlchemy | Python DB access for scrapers |
| **Scheduling** | APScheduler | Lightweight, in-process job scheduling |
| **Notifications** | Web Push API + email | Real-time alerts for conditions & deals |

## Project Structure

```
Water-Watcher/
├── web/                    # Next.js 15 web application
│   ├── src/
│   │   ├── app/            # App Router pages & API routes
│   │   ├── components/     # React components
│   │   ├── lib/            # Utilities, DB client, helpers
│   │   └── types/          # TypeScript type definitions
│   ├── prisma/             # Database schema & migrations
│   └── public/             # Static assets
├── pipeline/               # Python scraping pipeline
│   ├── scrapers/           # Per-source scraper modules
│   ├── processors/         # Data normalization & enrichment
│   ├── notifiers/          # Notification dispatch (push, email)
│   ├── models/             # SQLAlchemy models
│   ├── config/             # Pipeline configuration
│   └── main.py             # Entry point + scheduler
├── docker-compose.yml      # Local dev: PostgreSQL
├── .env.example            # Environment variable template
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- PostgreSQL 15+ (or use Docker)
- pnpm (recommended) or npm

### 1. Clone and configure

```bash
cp .env.example .env
# Edit .env with your database URL and API keys
```

### 2. Start the database

```bash
docker compose up -d
```

### 3. Set up the web app

```bash
cd web
pnpm install
pnpm prisma db push
pnpm dev
```

### 4. Set up the scraping pipeline

```bash
cd pipeline
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

## Architecture

### Data Flow

```
[Data Sources] → [Python Scrapers] → [Processors] → [PostgreSQL]
                                                          ↓
                                                    [Next.js API]
                                                          ↓
                                                    [React UI]

[Craigslist] → [Raft Watch Scraper] → [Match Filters] → [Notifications]
```

### Key API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/rivers` | List tracked rivers |
| GET | `/api/rivers/:id` | River detail + latest conditions |
| POST | `/api/rivers` | Add a river to track |
| GET | `/api/rivers/:id/conditions` | Condition history |
| GET | `/api/rivers/:id/hazards` | Current hazards & alerts |
| GET | `/api/rivers/:id/campsites` | Nearby campsites |
| GET | `/api/deals` | Raft Watch gear deals |
| POST | `/api/deals/filters` | Create/update deal filter |
| POST | `/api/notifications/subscribe` | Subscribe to push notifications |
| GET | `/api/user/preferences` | User preferences |

## Development

- **Web app** runs on `http://localhost:3000`
- **Pipeline** runs as a background process with configurable schedules
- Both share the same PostgreSQL database

## License

Private — Spencer Fowers
