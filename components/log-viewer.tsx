'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import type { OtlpExportLogsServiceRequest } from '@/lib/otlp-types'
import type { SeverityBand } from '@/lib/otlp-types'
import { flattenLogs, buildHistogram } from '@/lib/otlp-utils'
import { LogToolbar, type DensityMode, type ViewMode } from './log-toolbar'
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
  const [severityFilter, setSeverityFilter] = useState<SeverityBand[]>([...ALL_BANDS])
  const [density, setDensity] = useState<DensityMode>('condensed')
  const [viewMode, setViewMode] = useState<ViewMode>('flat')
  const [brushRange, setBrushRange] = useState<[number, number] | null>(null)

  const {
    data: rawData,
    error,
    isLoading,
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

    // Text search (body + service name + attributes values)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      logs = logs.filter(
        (l) =>
          l.body.toLowerCase().includes(q) ||
          l.serviceName.toLowerCase().includes(q) ||
          l.serviceNamespace.toLowerCase().includes(q) ||
          Object.values(l.logAttributes).some((v) => v.toLowerCase().includes(q)) ||
          Object.values(l.resourceAttributes).some((v) => v.toLowerCase().includes(q))
      )
    }

    // Sort by timestamp descending (newest first)
    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    return logs
  }, [allLogs, severityFilter, search, brushRange])

  const histogramBuckets = useMemo(
    () => buildHistogram(filteredLogs, 30),
    [filteredLogs]
  )

  const hasFilters =
    search.trim().length > 0 ||
    severityFilter.length !== ALL_BANDS.length ||
    brushRange !== null

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-11 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[13px] font-semibold text-foreground tracking-tight">
            otlp-log-viewer
          </span>
          {brushRange && (
            <button
              onClick={() => setBrushRange(null)}
              className="text-[11px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5 hover:text-foreground hover:border-foreground/30 transition-colors"
              aria-label="Clear time range filter"
            >
              time range ×
            </button>
          )}
        </div>
        <span className="text-[11px] font-mono text-muted-foreground hidden sm:block">
          press <kbd className="bg-muted rounded px-1 py-0.5 text-[10px]">/</kbd> to search
          &nbsp;·&nbsp;
          <kbd className="bg-muted rounded px-1 py-0.5 text-[10px]">j</kbd>
          <kbd className="bg-muted rounded px-1 py-0.5 text-[10px]">k</kbd> to navigate
          &nbsp;·&nbsp;
          <kbd className="bg-muted rounded px-1 py-0.5 text-[10px]">↵</kbd> to expand
        </span>
      </header>

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
