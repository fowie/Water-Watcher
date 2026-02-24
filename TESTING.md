# Testing Guide — Water-Watcher

This document explains how to run tests, what's covered, and how to add new tests.

## Quick Start

```bash
# Python pipeline tests
cd pipeline
pip install -r requirements-dev.txt
pytest

# TypeScript web tests
cd web
pnpm install
pnpm test
```

---

## Python Pipeline Tests

### Setup

```bash
cd pipeline
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
```

### Running Tests

```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run a specific test file
pytest tests/test_usgs_scraper.py

# Run a specific test class or function
pytest tests/test_deal_matcher.py::TestMatchesFilter::test_price_below_max

# Run with coverage report
pytest --cov=. --cov-report=term-missing

# Skip slow/integration tests
pytest -m "not slow and not integration"
```

### Test Files

| File | What it tests |
|------|---------------|
| `tests/test_base_scraper.py` | `ScrapedItem` dataclass, `BaseScraper` ABC (logging, subclassing) |
| `tests/test_usgs_scraper.py` | USGS API parsing, temp conversion, HTTP error handling, rate limiting |
| `tests/test_condition_processor.py` | Flow → runnability classification, quality mapping, processor pipeline |
| `tests/test_deal_matcher.py` | Filter matching: price, keywords, regions, categories, edge cases |
| `tests/test_models.py` | SQLAlchemy model structure: table names, columns, indexes, relationships |

### Mocking Strategy

- **HTTP:** Uses `respx` to mock `httpx` requests (USGS, Craigslist, AW)
- **Database:** Uses `unittest.mock` to mock `SessionLocal` — no real DB needed
- **Models:** Tested structurally (column names, types, indexes) without a DB connection

---

## TypeScript Web Tests

### Setup

```bash
cd web
pnpm install
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run in watch mode (re-runs on file changes)
pnpm test:watch

# Run with coverage report
pnpm test:coverage

# Run a specific test file
pnpm vitest run src/__tests__/validations.test.ts
```

### Test Files

| File | What it tests |
|------|---------------|
| `src/__tests__/validations.test.ts` | Zod schemas: `riverSchema`, `dealFilterSchema`, `pushSubscriptionSchema` |
| `src/__tests__/utils.test.ts` | Utility functions: `formatFlowRate`, `formatPrice`, `qualityColor`, `severityColor` |
| `src/__tests__/api/rivers.test.ts` | Rivers API: GET (list/search), POST (create), GET /:id (detail/404) |
| `src/__tests__/api/deals.test.ts` | Deals API: GET with filters, pagination, limit capping |
| `src/__tests__/api/deals-filters.test.ts` | Deal Filters API: GET/POST with validation, missing userId |
| `src/__tests__/api/notifications.test.ts` | Push Subscribe API: POST with validation, upsert behavior |

### Mocking Strategy

- **Prisma:** Mocked via `vi.mock("@/lib/db")` — no database needed
- **Request/Response:** Uses `new Request()` / `NextResponse` from the actual route handlers
- **No browser:** Tests run in `node` environment (not jsdom) since we're testing API routes

---

## Coverage Goals

| Area | Target | Notes |
|------|--------|-------|
| Pipeline core logic | **90%+** | `classify_runnability`, `classify_quality`, `_matches_filter` |
| Pipeline scrapers | **80%+** | Parsing logic; network calls are mocked |
| API route handlers | **85%+** | All endpoints, happy path + error paths |
| Validation schemas | **95%+** | Every field, valid + invalid + edge cases |
| Utility functions | **100%** | Pure functions, easy to cover fully |

---

## Adding New Tests

### Python

1. Create `tests/test_<module>.py` in the `pipeline/tests/` directory
2. Import fixtures from `conftest.py` or create new ones there
3. Use `@respx.mock` + `@patch` for external dependencies
4. Follow the pattern: `class TestClassName:` with `test_` methods

```python
# Example: testing a new scraper
import respx
import httpx
from unittest.mock import patch, MagicMock
from scrapers.my_scraper import MyScraper

class TestMyScraper:
    @respx.mock
    @patch("scrapers.my_scraper.SessionLocal")
    def test_scrape_happy_path(self, mock_session_cls):
        respx.get("https://api.example.com/data").mock(
            return_value=httpx.Response(200, json={"items": [...]})
        )
        scraper = MyScraper()
        items = scraper.scrape()
        assert len(items) > 0
```

### TypeScript

1. Create test files in `src/__tests__/` (mirroring the source structure)
2. Mock Prisma at the top of each API test file
3. Use `vi.mock`, `vi.fn()`, `vi.clearAllMocks()` from Vitest
4. For API routes, use `new Request()` to create test requests

```typescript
// Example: testing a new API route
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = { myModel: { findMany: vi.fn() } };
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/my-route/route";

describe("GET /api/my-route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns data", async () => {
    mockPrisma.myModel.findMany.mockResolvedValue([{ id: "1" }]);
    const res = await GET(new Request("http://localhost/api/my-route"));
    expect(res.status).toBe(200);
  });
});
```

---

## CI Integration

Both test suites can be run in CI with:

```yaml
# Python
- run: |
    cd pipeline
    pip install -r requirements-dev.txt
    pytest --cov=. --cov-report=xml

# TypeScript
- run: |
    cd web
    pnpm install
    pnpm test:coverage
```
