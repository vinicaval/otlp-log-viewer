# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (see `pnpm-lock.yaml`; do not use npm/yarn lockfiles).

```bash
pnpm dev      # start Next.js dev server (http://localhost:3000)
pnpm build    # production build
pnpm start    # run production build
pnpm lint     # eslint .
```

There is no test runner configured in this repo. `next.config.mjs` sets `typescript.ignoreBuildErrors: true`, so `pnpm build` will NOT fail on type errors — run `npx tsc --noEmit` explicitly to catch type issues.

## Architecture

This is a single-page OTLP (OpenTelemetry Protocol) log viewer: Next.js App Router, but effectively a client-rendered SPA behind one server route.

**Data flow:**
1. `app/api/logs/route.ts` — a server route that proxies the upstream mock API (`https://take-home-assignment-otlp-logs-api.vercel.app/api/v2/logs`), which returns a fresh random `IExportLogsServiceRequest` (OTLP Logs JSON) on every call. This route exists purely to avoid CORS/keep the upstream URL server-side; it does no transformation.
2. `components/log-viewer.tsx` is the root client component (`app/page.tsx` just renders it). It fetches `/api/logs` via SWR, then:
   - flattens the deeply nested OTLP shape (`resourceLogs[].scopeLogs[].logRecords[]`) into a flat array of `FlatLogRecord` via `lib/otlp-utils.ts#flattenLogs`
   - owns all UI state: search text, severity filter, density mode, view mode (flat/grouped), histogram time-brush range
   - derives `filteredLogs` and `histogramBuckets` from that state via `useMemo`
3. `lib/otlp-types.ts` defines the raw OTLP wire types (`Otlp*`) separately from the app's internal flattened shape (`FlatLogRecord`). Any change to how attributes/body/severity are interpreted belongs in `lib/otlp-utils.ts`, not scattered across components.

**Key transform logic (`lib/otlp-utils.ts`):**
- `nanosToDate` converts the wire format's `timeUnixNano` (string, since it exceeds `Number.MAX_SAFE_INTEGER`) to a `Date` using `BigInt` division — do not swap this for `Number(nanoStr) / 1e6`, it silently loses precision.
- `severityNumberToBand` maps the OTLP 1–24 `severityNumber` range to one of `TRACE|DEBUG|INFO|WARN|ERROR|FATAL` per the OTLP spec's banding.
- `anyValueToString` / `kvListToRecord` collapse OTLP's tagged-union `AnyValue` (`stringValue`/`intValue`/`arrayValue`/`kvlistValue`/...) into plain `Record<string, string>` for UI attribute grids.
- `buildHistogram` buckets `FlatLogRecord[]` into fixed-count, equal-width time buckets (severity-stacked) for `LogHistogram`. Buckets span the full min–max timestamp range of the *currently filtered* logs, so bucket width changes as filters are applied.

**View composition:**
- `LogList` renders the flat chronological view; `LogGroupedView` groups the same `FlatLogRecord[]` by `serviceNamespace::serviceName` and renders one `LogList` per group (collapsible). Both consume the same row/detail components (`SeverityBadge`, `LogRowDetail`, `AttributeGrid`), so row-rendering changes should go in those shared components, not be duplicated per view.
- `LogHistogram` supports drag-to-brush time selection (Recharts `BarChart` with manual mouse handlers, not Recharts' built-in `Brush`), which feeds back into `LogViewer`'s `brushRange` state and re-filters the list.
- Density (`condensed`/`expanded`) and view mode (`flat`/`grouped`) are lifted to `LogViewer` and passed down as props — there is no global state manager (no Redux/Zustand/context) despite `recharts`' transitive dependency on Redux internals showing up in the lockfile; don't read anything into that.

**Styling:** Tailwind v4 with CSS variables defined in `app/globals.css` (shadcn "base-nova" style, `components.json`). Dark mode is the default (`<html class="dark">` in `app/layout.tsx`); severity colors and chart colors are defined once in `components/severity-badge.tsx` (`BAND_STYLES` for Tailwind classes, `SEVERITY_CHART_COLORS` for raw hex values Recharts needs). Fonts are `Geist`/`Geist Mono` via `next/font/google`, with monospace used throughout for technical values (timestamps, IDs, attribute keys/values) per this project's design intent of sustained, low-fatigue reading for an observability tool.

## Known gaps (as of last review)

- `react-window` is a listed dependency but not actually used anywhere — `LogList`/`LogGroupedView` render full arrays via `.map()`, no virtualization.
- Keyboard nav (`j`/`k`/`Enter`/`Esc`) is implemented per-`LogList` instance with a `document`-level listener; in grouped view with multiple groups expanded, multiple listeners fire concurrently.
- `/api/logs` sets `next: { revalidate: 30 }`, which caches the upstream response server-side for 30s — the UI's "Refresh" button can appear to no-op within that window since the upstream mock API otherwise returns new random data on every call.
