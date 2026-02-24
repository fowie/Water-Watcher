# SKILL: Two-Service Web + Pipeline Architecture

## Pattern
When a project needs both a web UI and a background data pipeline (scraping, ETL, scheduled jobs), use a two-directory layout sharing a database as the integration layer.

## Structure
```
project/
├── web/       # Web framework (Next.js, etc.) — owns schema, migrations, UI, API
├── pipeline/  # Background workers (Python, etc.) — owns scrapers, processors, notifiers
└── docker-compose.yml  # Shared infrastructure (database, cache)
```

## Rules
1. **One canonical schema owner.** The web framework's ORM (Prisma) owns migrations. The pipeline ORM (SQLAlchemy) mirrors the schema but doesn't drive migrations.
2. **Database is the contract.** No RPC or message queues between services. Both read/write to the same database.
3. **Independent deployability.** Each service has its own package manager, dependencies, and runtime.
4. **Clear ownership.** Frontend devs own `web/`, backend devs own `pipeline/`. Minimal merge conflicts.

## When to Use
- Solo or small team projects needing both web UI and data processing
- Projects where scraping/ETL is a distinct concern from serving web pages
- When different languages are optimal for different parts (e.g., Python for scraping, TypeScript for web)

## Anti-Patterns
- Don't add a message queue (Redis/RabbitMQ) unless you actually need async job processing beyond simple scheduling
- Don't try to share ORM models across languages — just keep them in sync manually
- Don't put both services in the same runtime process
