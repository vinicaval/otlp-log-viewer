# OTLP Log Viewer

A log viewer for OTLP (OpenTelemetry Protocol) log records — built for engineers to quickly scan logs, drill into details, and spot distribution patterns across services.

## Features

- **Log list** — Severity / Time / Body columns, virtualized for smooth scrolling over large result sets. Each row expands inline into a full detail panel (message, metadata, log/resource/scope attributes), with JSON bodies pretty-printed and every value copyable.
- **Histogram** — Time-bucketed, severity-stacked bar chart above the list. Drag across it to brush-select a time range and filter the list to it; hover a bucket for an exact per-severity breakdown.
- **Group by service** — Toggle between a flat chronological list and groups keyed by `service.namespace`/`service.name`, each collapsible with its own count and severity breakdown.
- **Search & severity filters**, a **density toggle** (condensed/expanded rows), and **keyboard navigation** (`/` to search, `j`/`k` to move, `Enter` to expand, `Esc` to collapse) in the flat view.

## Design notes

Built with sustained reading comfort in mind — this is a screen an engineer might stare at for a while during an incident, not a marketing page:

- Geist Sans / Geist Mono throughout, monospace for anything technical (timestamps, IDs, attribute keys/values) with `tabular-nums` for alignment.
- Dark mode by default, near-black rather than pure black, muted severity colors — legible at a glance without being harsh over long sessions.
- Severity is never color-only: every badge pairs a color dot with a text label.
- No query language required to explore the data — plain-text search and one-click severity filters instead of a DSL.

## Stack

Next.js (App Router) + TypeScript (strict) + Tailwind v4 + shadcn/ui + Recharts (histogram) + `react-window` (list virtualization) + SWR (data fetching) + Vitest/Testing Library (unit tests) + Playwright (e2e tests).

## Architecture

- `app/api/logs/route.ts` proxies the upstream mock API server-side (`cache: 'no-store'` — the upstream returns fresh random data on every call, and the UI's Refresh button depends on that).
- `lib/otlp-types.ts` / `lib/otlp-utils.ts` — OTLP wire types kept separate from the app's flattened `FlatLogRecord` shape, with all the nested-data transformation (nanosecond timestamp parsing via `BigInt`, OTLP `AnyValue` → plain string, severity-number → severity-band mapping, histogram bucketing) isolated into pure, unit-testable functions rather than scattered across components.
- `components/log-viewer.tsx` owns all UI state (search, filters, density, view mode, time-brush range) and derives the filtered/bucketed data via `useMemo`; `LogList`, `LogGroupedView`, and `LogHistogram` are otherwise presentational.

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the full architecture doc, and [docs/PRD.md](./docs/PRD.md) for the product requirements doc.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push/PR to `main`: a lint + typecheck + unit-test job, and a separate Playwright e2e job (Chromium, with a cached browser install and a report artifact uploaded on failure).

## Getting started

Requires Node.js ≥ 20.9.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
pnpm lint      # eslint
pnpm build     # production build (type-checked)
pnpm test      # unit tests (vitest)
pnpm test:e2e  # e2e tests (playwright)
```

## Possible improvements

**More filters**
- Advanced filter capability through rich query language or query builder.
- An explicit date-range input as an alternative to dragging on the histogram.
- Persist active filters in the URL so a filtered view can be shared/bookmarked.

**More charts**
- Toggle between line charts and bar charts; line charts can give hints of trends.

**API improvements**
- Server-side filters: accept query params (severity, service, search, time range) in `app/api/logs/route.ts` so filtering happens before the payload is sent to the client, instead of shipping the full dataset every time.

**Handling much larger datasets**
- Pagination or streaming support in `app/api/logs/route.ts`, which currently proxies one full JSON payload with no pagination.

**Monitoring**
- Add Dash0 website monitoring to get web vitals information.
