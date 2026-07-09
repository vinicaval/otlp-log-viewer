'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import type { OtlpExportLogsServiceRequest } from '@/lib/otlp-types'
import type { SeverityBand } from '@/lib/otlp-types'
import { flattenLogs, buildHistogram } from '@/lib/otlp-utils'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { LogToolbar, type DensityMode, type ViewMode } from './log-toolbar'
import { LogHeader } from './log-header'
import { LogHistogram } from './log-histogram'
import { LogList } from './log-list'
import { LogGroupedView } from './log-grouped-view'
import {
  HistogramSkeleton,
  LogRowSkeleton,
  ErrorState,
  EmptyState,
} from './log-skeletons'

const ALL_BANDS: SeverityBand[] = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL', 'UNSPECIFIED']

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function LogViewer() {
  const [search, setSearch] = useState('')
  // The input itself stays bound to `search` (instant feedback), but
  // filtering runs off a debounced value — typing fast shouldn't trigger a
  // full filter+sort pass over every log on every keystroke.
  const debouncedSearch = useDebouncedValue(search, 200)
  const [severityFilter, setSeverityFilter] = useState<SeverityBand[]>([...ALL_BANDS])
  const [density, setDensity] = useState<DensityMode>('condensed')
  const [viewMode, setViewMode] = useState<ViewMode>('flat')
  const [brushRange, setBrushRange] = useState<[number, number] | null>(null)

  const {
    data: rawData,
    error,
    isLoading,
    isValidating,
    mutate,
  } = useSWR<OtlpExportLogsServiceRequest>('/api/logs', fetcher, {
    revalidateOnFocus: false,
  })

  const allLogs = useMemo(() => {
    if (!rawData?.resourceLogs) return []
    return flattenLogs(rawData)
  }, [rawData])

  const filteredLogs = useMemo(() => {
    let logs = allLogs

    // Severity filter
    if (severityFilter.length !== ALL_BANDS.length) {
      logs = logs.filter((l) => severityFilter.includes(l.severityBand))
    }

    // Time brush range
    if (brushRange) {
      logs = logs.filter(
        (l) =>
          l.timestamp.getTime() >= brushRange[0] &&
          l.timestamp.getTime() <= brushRange[1]
      )
    }

    // Text search (body + service name + attributes values) — matched
    // against each log's precomputed lowercase searchHaystack rather than
    // re-lowercasing/re-walking every field on every search.
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase()
      logs = logs.filter((l) => l.searchHaystack.includes(q))
    }

    // Sort by timestamp descending (newest first)
    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    return logs
  }, [allLogs, severityFilter, debouncedSearch, brushRange])

  const histogramBuckets = useMemo(
    () => buildHistogram(filteredLogs, 30),
    [filteredLogs]
  )

  const hasFilters =
    debouncedSearch.trim().length > 0 ||
    severityFilter.length !== ALL_BANDS.length ||
    brushRange !== null

  return (
    <div className="flex flex-col h-screen bg-background">
      <LogHeader
        brushRange={brushRange}
        onClearBrushRange={() => setBrushRange(null)}
        viewMode={viewMode}
      />

      {/* Toolbar */}
      <LogToolbar
        search={search}
        onSearchChange={setSearch}
        severityFilter={severityFilter}
        onSeverityFilterChange={setSeverityFilter}
        density={density}
        onDensityChange={setDensity}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        totalCount={allLogs.length}
        filteredCount={filteredLogs.length}
        isLoading={isLoading}
        isRefreshing={isValidating}
        onRefresh={() => mutate()}
      />

      {/* Histogram */}
      {isLoading ? (
        <HistogramSkeleton />
      ) : error ? null : allLogs.length > 0 ? (
        <LogHistogram
          buckets={histogramBuckets}
          brushRange={brushRange}
          onBrushChange={setBrushRange}
        />
      ) : null}

      {/* Main content */}
      <main className="flex flex-col flex-1 min-h-0">
        {isLoading ? (
          <LogRowSkeleton count={12} />
        ) : error ? (
          <ErrorState
            message={
              error instanceof Error ? error.message : 'Failed to fetch logs'
            }
          />
        ) : filteredLogs.length === 0 ? (
          <EmptyState hasFilters={hasFilters} />
        ) : viewMode === 'grouped' ? (
          <LogGroupedView logs={filteredLogs} density={density} />
        ) : (
          <LogList logs={filteredLogs} density={density} />
        )}
      </main>
    </div>
  )
}
