# Routing Rules

## Default Routes

| Pattern | Agent | Notes |
|---------|-------|-------|
| Architecture, scope, tech decisions | Bodhi | Lead makes structural calls |
| Code review, PR review | Bodhi | Lead reviews all code |
| UI, components, styling, responsive design | Tyler | Frontend work |
| Layout, pages, navigation, forms | Tyler | Frontend work |
| APIs, endpoints, database, data models | Utah | Backend work |
| Scraping, data pipeline, aggregation | Utah | Backend work |
| Craigslist monitoring, notifications, alerts | Utah | Backend work |
| River data sources (BLM, USFS, AW, Facebook) | Utah | Backend scraping |
| Tests, test cases, QA, edge cases | Pappas | Testing work |
| Integration tests, E2E tests | Pappas | Testing work |
| Memory, decisions, logs, session tracking | Scribe | Silent ops |
| Work queue, backlog, monitoring | Ralph | Work monitor |

## Multi-Agent Routes

| Pattern | Agents | Notes |
|---------|--------|-------|
| New feature (full stack) | Bodhi + Tyler + Utah + Pappas | Lead architects, devs build, tester validates |
| "Team" requests | All relevant agents | Fan-out based on scope |
| Bug fix | Bodhi (triage) → relevant dev | Lead triages, routes to right dev |

## Ambiguity Resolution

- If unclear whether frontend or backend → route to Bodhi for triage
- Performance issues → Utah (backend first, then Tyler if UI-related)
- Data display issues → Tyler (presentation) unless data is wrong → Utah
