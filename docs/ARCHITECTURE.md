# Architecture & Tech Stack

Engineering-facing companion to [`docs/PRD.md`](./PRD.md) (the product/requirements view) and [`CLAUDE.md`](../CLAUDE.md) (the terse coding-agent reference). This document is for a human getting oriented in the codebase for the first time.

## 1. Shape of the app

This is a single-page app wearing a Next.js App Router costume: one real route (`/`), one API route that exists purely as a CORS-safe proxy, and everything else is client-side state and rendering. There is no server-rendered data — the page ships an empty shell, then fetches and does all the work in the browser.

```
Browser
  │
  │  GET /api/logs
  ▼
app/api/logs/route.ts  ──►  upstream mock API (cache: 'no-store')
  │
  │  raw OTLP JSON (IExportLogsServiceRequest)
  ▼
components/log-viewer.tsx (root client component, fetches via SWR)
  │
  ├─ lib/otlp-utils.ts#flattenLogs   → FlatLogRecord[]   (useMemo, keyed on rawData)
  ├─ filter/search/sort              → filteredLogs      (useMemo, keyed on filters)
  └─ lib/otlp-utils.ts#buildHistogram → HistogramBucket[] (useMemo, keyed on filteredLogs)
       │
       ▼
  ┌─────────────┬──────────────┬────────────────────────────┐
  │ LogHeader   │ LogToolbar   │ LogHistogram                │
  └─────────────┴──────────────┴────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                          ▼
              LogList (flat)           LogGroupedView
              (react-window)           (one LogList per service group)
```

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) | Single-route app; App Router mostly used for its dev tooling and API route convention, not for SSR/RSC data flow — this is effectively an SPA. |
| Language | **TypeScript 5.7**, strict mode | OTLP's nested, tagged-union shape (`AnyValue`) is exactly the kind of data where "did I handle every variant" needs the compiler's help. |
| UI | **React 19** | Comes with Next 16; no notable use of newer React 19 features beyond what Next requires. |
| Styling | **Tailwind CSS v4** + **shadcn/ui** (`base-nova` style) | Utility-first for a UI with a lot of small, one-off density/spacing decisions; shadcn for the couple of primitives actually used (`components/ui/button.tsx`) rather than pulling in a full component library. |
| Charts | **Recharts 3** | `LogHistogram` is a `BarChart` with severity-stacked `Bar`s and a hand-rolled drag-to-brush interaction (Recharts' own `Brush` component didn't fit the severity-stacked-bar + time-range use case). |
| List rendering | **react-window 2** | Virtualizes `LogList` so DOM node count stays constant (~20–30 mounted rows) regardless of how many logs are loaded — see §5. |
| Data fetching | **SWR 2** | Small, handles the dedup/loading-state bookkeeping (`isLoading` vs `isValidating`) that the Refresh button's disabled/spinner state depends on. |
| Icons | **lucide-react** | |
| Unit tests | **Vitest 4** + **jsdom** + **React Testing Library** | Fast, ESM-native, no separate transpilation config needed alongside Next's own toolchain. |
| E2E tests | **Playwright** (Chromium) | Real-browser coverage of the actual user flows, against a mocked API response for determinism. |
| CI | **GitHub Actions** | Two parallel jobs — lint/typecheck/unit, and e2e — on every push/PR to `main`. |
| Package manager | **pnpm** (pinned via `packageManager` in `package.json`) | |
| Deployment | **Vercel** | Auto-deploys `main`. |

## 3. Directory layout

```
app/
  api/logs/route.ts   — server-side proxy to the upstream OTLP API
  layout.tsx           — root layout: fonts (Geist/Geist Mono), dark mode default, metadata
  page.tsx              — renders <LogViewer /> and nothing else
  globals.css           — Tailwind v4 config + CSS custom properties (theme, severity colors)

components/
  log-viewer.tsx         — root client component: owns all UI state, orchestrates data flow
  log-header.tsx          — title bar + keyboard-shortcut hints + brush-range clear button
  log-toolbar.tsx          — search box, density/view-mode toggles, refresh button, severity chips
  log-histogram.tsx         — the severity-stacked bar chart + drag-to-brush
  log-list.tsx                — the virtualized flat log list (react-window)
  log-grouped-view.tsx          — groups FlatLogRecord[] by service, renders one LogList per group
  log-row-detail.tsx             — the expanded-row detail panel (message, metadata, attributes)
  attribute-grid.tsx              — key/value attribute rendering, shared by detail panels
  severity-badge.tsx               — severity dot+label badge; also exports chart color constants
  log-skeletons.tsx                 — loading/empty/error state components
  ui/button.tsx                     — shadcn primitive

lib/
  otlp-types.ts   — raw OTLP wire types, kept separate from the app's internal shape
  otlp-utils.ts    — all data transformation: flattenLogs, buildHistogram, severity mapping,
                     nanosecond→Date conversion, search-string construction
  use-debounced-value.ts — generic debounce hook (used for the search input)
  utils.ts                — shadcn's `cn()` className helper

e2e/           — Playwright specs + a deterministic OTLP fixture + shared route-mocking helper
docs/          — this file, PRD.md
```

## 4. State management

There is no global state manager (no Redux/Zustand/Context) — `log-viewer.tsx` owns every piece of UI state (`search`, `severityFilter`, `density`, `viewMode`, `brushRange`) as plain `useState`, and passes derived data down as props. `filteredLogs` and `histogramBuckets` are `useMemo`-derived from that state rather than stored separately, so there's exactly one source of truth for "what's currently visible."

This is deliberate, not an oversight: the component tree is shallow (one root component, a handful of direct children), and every piece of state is consumed by at most two or three components. A state library would add indirection without solving a problem that exists here.

## 5. The two performance-sensitive paths

**Rendering large lists.** `LogList` renders through react-window's `List`, using `useDynamicRowHeight` rather than a fixed row height — an expanded row's detail panel varies in height with its content, so heights are measured off the actual rendered DOM rather than estimated. Only visible rows (+ overscan) exist in the DOM at any time; verified via direct DOM inspection that mounted row count stays ~20–30 regardless of whether the underlying dataset is 300 or 50,000 records.

**Filtering large lists.** Two things happen once, at data-load time, rather than being repeated on every keystroke:
- `flattenLogs` computes a `searchHaystack` string per record (lowercased concatenation of every searchable field) so the search filter is a single `.includes()` per log instead of five separate `.toLowerCase()`/`Object.values()` calls.
- The search *input* is debounced 200ms before it feeds the `filteredLogs` recompute, so fast typing doesn't trigger a full filter+sort pass per character.

Stress-tested against synthetic payloads up to 50,000 records in a production build: full fetch→parse→flatten→filter→bucket pipeline completes in ~190ms. See `docs/PRD.md` §4.2 for the numbers.

## 6. Data model

Two parallel type hierarchies, deliberately kept separate (`lib/otlp-types.ts`):

- **`Otlp*` types** — the raw wire format (`OtlpExportLogsServiceRequest → OtlpResourceLogs[] → OtlpScopeLogs[] → OtlpLogRecord[]`), matching the OTLP Logs protobuf-JSON schema exactly, including its tagged-union `AnyValue` type for attribute values.
- **`FlatLogRecord`** — the app's internal shape: one flat array, one object per log line, with resource/scope context denormalized onto each record (`serviceName`, `serviceNamespace`, etc.) and a synthetic `id` for React keys.

`flattenLogs` is the only function that bridges the two, and it's where every "does this API actually populate the field the spec says it should" discovery has landed — e.g. this particular upstream API never populates `OtlpLogRecord.traceId`/`spanId` (the OTLP wire-format fields), it puts the same data under `attributes["trace.id"]`/`["span.id"]` instead; `flattenLogs` checks both, preferring the spec-correct field.

## 7. Testing architecture

- **`lib/*.test.ts`, `components/*.test.ts`** (Vitest) — pure-function and hook-level unit tests, concentrated on `lib/otlp-utils.ts` since that's where nested-data-transformation bugs actually occur (severity mapping edge cases, nanosecond precision, attribute fallback logic).
- **`e2e/*.spec.ts`** (Playwright) — full user flows against a real browser and a real production build, with the upstream API mocked via `page.route()` for determinism (the real API returns fresh random data on every call, which is exactly wrong for assertions like "there should be exactly 3 matches").
- **CI** (`.github/workflows/ci.yml`) — both suites run on every push/PR to `main`, in parallel jobs.

## 8. Notable constraints inherited from the upstream API

- No pagination or query params — the proxy route always fetches and returns the full payload.
- Data is fully random on every call — nothing about content, volume, or time range is stable across requests, which shaped both the e2e testing approach (mock instead of hitting the real API) and a few UI decisions (e.g. the histogram's bucket width is derived from the actual min/max timestamp of whatever came back, not a fixed window).
- Some OTLP fields the spec defines are simply never populated by this particular mock generator (`traceId`/`spanId` at the wire-format level; see §6) — worth checking against real field presence rather than trusting the spec alone when integrating a new field.
