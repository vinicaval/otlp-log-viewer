# PRD — OTLP Log Viewer

**Status:** Living document, reflects the shipped v1 · **Owner:** Vinicius Donato · **Last updated:** 2026-07-09

## 1. Problem

Engineers debugging an incident need to go from "something's wrong" to "here's the specific log line that explains it" as fast as possible. Raw OTLP log exports are deeply nested JSON (`resourceLogs[].scopeLogs[].logRecords[]`) — not something anyone can scan visually. Existing tools in this space (Datadog, Grafana/Loki, Splunk) solve this but introduce their own friction: query languages you have to learn before you can look at anything, pagination that breaks pattern-recognition across sequential lines, and UI chrome from a dozen other products competing for attention.

This project is a focused, single-purpose log viewer for OTLP log records: fetch, flatten, scan, filter, drill in. Nothing else.

## 2. Goals

- Let an engineer land on the page and understand what happened **without reading documentation first**.
- Make **severity** and **time** the two fastest things to scan, since those drive "is this bad, and when did it start."
- Surface every field an OTLP log record carries (body, attributes, resource, scope) without requiring a second tool.
- Stay usable at realistic incident-response volume (hundreds to tens of thousands of log lines) without the UI becoming the bottleneck.
- Be a screen someone can comfortably stare at for an hour during an incident, not just look good in a screenshot.

### Non-goals (v1)

- Log ingestion, storage, or retention — this reads from a single fixed API endpoint, it doesn't own the data.
- Alerting, dashboards, or anything beyond a single log-viewing session.
- Multi-signal correlation (traces/metrics) beyond surfacing `trace.id`/`span.id` as inspectable fields.
- Authentication/multi-tenancy — out of scope for this exercise.

## 3. Users

Primary: a backend/platform engineer during or after an incident, or doing routine log spelunking. They know what a `trace.id` and a severity level are; they don't want to learn a new query syntax to use this tool for the first time.

## 4. Requirements

### 4.1 Functional (all shipped)

| # | Requirement | Notes |
|---|---|---|
| 1 | **Log list** — table of Severity / Time / Body | Rows expand inline to show every log/resource/scope attribute; JSON bodies pretty-print; every value is copyable. |
| 2 | **Histogram** — log volume over time | Severity-stacked bars; drag-to-brush a time range to filter the list to it. |
| 3 | **Group by service** — toggle flat ↔ grouped | Groups keyed by `service.namespace`/`service.name`, collapsible, each with a count and per-severity breakdown, sorted worst-first (errors/fatals surface at the top). |
| 4 | Search | Plain-text substring match across body + all attribute values — no query language. |
| 5 | Severity filter | One-click chips per band (including `UNSPECIFIED` for `severityNumber: 0`, which the OTLP spec defines but which is easy to mis-map onto `INFO` if you're not careful). |
| 6 | Density toggle | Condensed vs. expanded row height. |
| 7 | Keyboard navigation | `/` to search, `j`/`k` to move, `Enter` to expand, `Esc` to collapse — flat view only (see §7). |
| 8 | Refresh | Re-fetches; button disables and the spinner animates for the duration of the request. |

### 4.2 Non-functional

- **Performance:** stress-tested against synthetic payloads up to 50,000 log records (~38MB) in a production build — full fetch→parse→transform→bucket pipeline completes in ~190ms; virtualized rendering keeps mounted DOM rows constant (~20–30) regardless of total count.
- **Reading comfort:** dark-mode default, near-black rather than pure black, muted severity colors, monospace with `tabular-nums` for technical values, severity never conveyed by color alone (every badge pairs a color dot with a text label).
- **Resilience to duplicate/rapid actions:** the Refresh button can't fire overlapping concurrent requests to the upstream API.
- **Data fidelity:** correlation IDs and severity are read from wherever the API actually puts them (this API stores `trace.id`/`span.id` as attributes rather than the OTLP wire-format's dedicated fields; the ingestion layer normalizes this).

## 5. Design principles

Set explicitly at the start of the project and held to throughout:

1. **No query language required.** Plain-text search and one-click filters, not a DSL — the single biggest complaint about Grafana/Loki-style tools for a first-time user.
2. **One focused screen, not a suite.** No multi-product chrome competing for attention — the opposite failure mode from Datadog.
3. **Nothing requires documentation to understand.** First-time users should grok the screen in seconds — the opposite failure mode from Splunk.
4. **Virtualize, don't paginate.** Pagination breaks pattern-recognition across sequential log lines; the list stays a single continuous scroll regardless of volume.
5. **Severity is never color-only.** Accessibility and scanability both require a text label alongside every color cue.

## 6. Technical architecture (summary)

Next.js (App Router) + TypeScript (strict) + Tailwind v4 + shadcn/ui + Recharts (histogram) + `react-window` (list virtualization) + SWR (data fetching). `app/api/logs/route.ts` proxies the upstream API server-side; `lib/otlp-utils.ts` isolates all OTLP-shape transformation (nanosecond timestamp parsing, severity mapping, attribute flattening) into pure, unit-tested functions, kept separate from the components that render the result. Full detail in [CLAUDE.md](../CLAUDE.md).

## 7. Known limitations / explicit trade-offs

- **Keyboard navigation is flat-view only.** Grouped view renders one virtualized list per service group; giving keyboard nav a single global scope across N independently-collapsible lists was judged not worth the added state-lifting complexity for a secondary affordance. Click-to-expand/collapse works identically in both views.
- **No server-side filtering.** `app/api/logs/route.ts` proxies the full payload on every request; filtering is entirely client-side. Fine at the data volumes this API actually returns (hundreds of records); would need server-side query params before scaling to a real production log volume.
- **Group list itself isn't virtualized**, only the rows *within* each group are (via `react-window`). A dataset with thousands of distinct services would need this addressed.
- **Drag-to-brush and its underlying bucket-index logic have unit and e2e coverage**, but the interaction was genuinely difficult to automate reliably in a headless browser during earlier iteration — noted here since it's the one interaction in the app that took the most iteration to get both correct and testable.

## 8. Testing & quality gates

- **Unit tests** (Vitest): the OTLP data-transformation layer — severity mapping, nanosecond precision, attribute flattening, histogram bucketing, search-string construction. This is the layer where real bugs have shipped before (see §9), so it's the highest-value place for tests to live.
- **E2E tests** (Playwright, against a deterministic mocked API response): log list rendering/expansion, histogram, group-by-service, search/filters, refresh, keyboard nav.
- **CI** (GitHub Actions): lint + typecheck + unit tests, and a separate e2e job, on every push/PR to `main`.

## 9. Notable bugs found and fixed during development

Kept here as a record of what "production-ready" actually required beyond the initial feature build — each of these shipped once and was caught by later review, not by the original implementation:

- `severityNumber: 0` (OTLP's "unspecified" value) was silently displayed as `INFO`.
- The upstream response was being cached server-side, making the Refresh button appear to do nothing.
- The histogram's time-bucket labels could collide across a UTC day boundary, causing bars to visually merge and the brush/tooltip to resolve the wrong bucket.
- Keyboard navigation fired identically across every expanded group in the grouped view (one global listener per group instead of one for the whole screen).
- `react-window` was a listed dependency that was never actually wired up — the list wasn't really virtualized until this was fixed.
- Search re-computed lowercased strings across every field of every log on every keystroke; there was no debounce.
- Trace/span IDs were read from the OTLP wire format's dedicated fields, which this particular API never populates — the real values were sitting in `attributes["trace.id"]`/`["span.id"]` and were silently dropped.

## 10. Open questions (feeds the filtering/sharing discussion)

The next planned feature — "let users filter logs and share interesting findings with teammates" — is deliberately under-specified as a product brief. Before implementation, this needs answers to:

- **Filter scope:** attribute-value filters in addition to severity/search/time? Structured (`key:value`) query syntax, or does that violate design principle #1?
- **Share mechanism:** a URL encoding the current filter state (search/severity/time-range/group-mode), a saved-view concept, or an exported snapshot of the currently-visible rows?
- **Persistence:** do shared filters need to survive the underlying data changing (the upstream API returns different random data on every fetch in this exercise, but a real backend would have stable historical data)?
- **Who's "teammates" here:** is sharing a link sufficient, or does it imply some notion of team/workspace this app doesn't currently have?

See [README.md](../README.md#possible-improvements) for the fuller list of scoped-but-not-built improvements this PRD's requirements deliberately left for later.
