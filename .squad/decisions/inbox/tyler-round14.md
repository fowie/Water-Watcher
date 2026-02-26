# Tyler — Round 14 Decisions

## FE-007: Onboarding Wizard — localStorage Completion Tracking
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Onboarding completion tracked via `localStorage` key `water-watcher-onboarding-complete` rather than a server-side flag on the User model. Rationale: avoids schema changes, instant read (no API call), and the wizard is purely a UX convenience — if localStorage is cleared, the user simply sees the wizard again (no harm). If we later want server-side tracking, we can layer it on without breaking the existing flow.

## FE-008: ErrorFallback Component with Variant System
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Created a reusable `ErrorFallback` component with 4 variants (`not-found`, `server-error`, `network-error`, `auth-error`). Each variant has a default icon, title, and description that can be overridden via props. Existing error boundaries (`app/error.tsx`, `rivers/[id]/error.tsx`) refactored to use it. New error boundaries should use `ErrorFallback` instead of building custom Card layouts. The `onRetry` callback enables Try Again behavior, `showReportLink` adds a GitHub issues link.

## FE-009: Print Stylesheet Strategy
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

Print styles live in a single `@media print` block at the end of `globals.css`. Uses role-based and attribute selectors (`[role="tabpanel"]`, `[role="tablist"]`, `a[href^="http"]`) for durability — they work regardless of Tailwind class name changes. Forces light theme via `!important` overrides. River detail tabs are displayed sequentially (all panels visible) in print. Custom `print:hidden` class available for any element that should be hidden when printing.

## FE-010: NetworkStatus Offline Banner
**Status:** Accepted — **Date:** 2026-02-24 — **By:** Tyler

`NetworkStatus` component mounted in root layout shows a dismissable banner when the browser goes offline. Uses `navigator.onLine` + `online`/`offline` events. Auto-hides on reconnection. z-index 60 places it above all other UI including navigation (z-30) and modals (z-50).
