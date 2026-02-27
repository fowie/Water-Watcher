# Tyler — Round 15 Decisions

## FE-007: SVG-Only Flow Charts (No Charting Library)
**Status:** Accepted — **Date:** 2026-02-26 — **By:** Tyler

Built `flow-chart.tsx` using raw SVG — no Chart.js, Recharts, or other charting library. This keeps bundle size minimal and avoids dependency conflicts with Next.js App Router SSR. The chart uses `ResizeObserver` for responsive sizing and CSS custom properties for theme-aware colors. Trade-off: more code to maintain, but zero added dependencies and full control over rendering.

## FE-008: Flow Chart Fetches from `/api/rivers/[id]/flow-history`
**Status:** Accepted — **Date:** 2026-02-26 — **By:** Tyler

The `FlowChart` component fetches from `GET /api/rivers/[id]/flow-history?range=7d`. **Utah needs to build this endpoint.** Expected response shape: `{ data: Array<{ timestamp: string, flowRate: number }>, riverId: string, range: string }`. Supports `range` query param with values: `24h`, `7d`, `30d`, `90d`.

## FE-009: Sparkline Data Architecture
**Status:** Accepted — **Date:** 2026-02-26 — **By:** Tyler

`ConditionSparkline` accepts a simple `data: (number | null)[]` array prop rather than fetching its own data. This keeps it lightweight and avoids N+1 fetch waterfalls on the rivers list page. River cards pass `sparklineData` as an optional prop — the parent page is responsible for providing the data (either from a batch endpoint or from existing condition records). If no sparkline data is passed, the sparkline simply doesn't render.

## FE-010: PWA Install Prompt Session Dismissal
**Status:** Accepted — **Date:** 2026-02-26 — **By:** Tyler

Install prompt uses `sessionStorage` (not `localStorage`) for dismissal tracking. This means users who dismiss the prompt will see it again next session — important for re-engagement since PWA install is a key conversion moment. The prompt auto-hides when the app detects it's running in standalone mode.
