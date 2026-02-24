## BD-015: Docker Production Configuration
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

### Docker Compose Services
Four services: `postgres` (PostgreSQL 16 Alpine), `db-migrate` (runs Prisma migrations, exits), `web` (Next.js standalone), `pipeline` (Python scrapers). Migration service uses builder stage from web Dockerfile and runs `prisma db push --skip-generate`. Both web and pipeline depend on successful migration before starting.

### Dockerfile Patterns
- **Web:** Multi-stage (deps → builder → runner). Uses pnpm with `--frozen-lockfile`. Standalone output mode (`output: "standalone"` in next.config.ts). Production image runs as non-root `nextjs` user. Prisma client copied into production stage.
- **Pipeline:** Single stage, Python 3.12-slim. Installs system deps for psycopg2 and lxml compilation. Installs Playwright chromium for JS-rendered pages.

### Environment Variables
All env vars use `${VAR:-default}` syntax in compose file so `.env` file is optional for basic local usage. Docker internal hostname is `postgres` (service name), not `localhost`.

---

## BD-016: GitHub Actions CI Workflow
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Four parallel jobs: `web-test` (vitest), `web-build` (next build for type errors), `web-lint` (eslint), `pipeline-test` (pytest). All use official setup actions with caching. Triggers on push to main/dev and PRs. Prisma generate runs before all web jobs since tests and build import Prisma client.

---

## BD-017: README Overhaul
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Utah

Comprehensive README with: project description, feature list, tech stack table, Docker quick start, local dev setup, VAPID key generation, project structure, complete API endpoint table (13 routes), testing commands, architecture diagram, contributing guide, MIT license.
