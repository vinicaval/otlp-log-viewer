'use client'

import { useEffect, useRef } from 'react'
import { Search, X, LayoutList, Rows3, Rows4, RefreshCw } from 'lucide-react'
import type { SeverityBand } from '@/lib/otlp-types'
import { SeverityBadge } from './severity-badge'

export type DensityMode = 'condensed' | 'expanded'
export type ViewMode = 'flat' | 'grouped'

const ALL_BANDS: SeverityBand[] = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL', 'UNSPECIFIED']

interface LogToolbarProps {
  search: string
  onSearchChange: (v: string) => void
  severityFilter: SeverityBand[]
  onSeverityFilterChange: (bands: SeverityBand[]) => void
  density: DensityMode
  onDensityChange: (d: DensityMode) => void
  viewMode: ViewMode
  onViewModeChange: (v: ViewMode) => void
  totalCount: number
  filteredCount: number
  isLoading: boolean
  // SWR's `isLoading` is only true for the very first fetch (no data yet);
  // it stays false for every subsequent Refresh since data already exists.
  // `isRefreshing` (SWR's isValidating) covers those too, so the spinner
  // actually animates on refresh and the button can be disabled to guard
  // against duplicate concurrent requests to the upstream API.
  isRefreshing: boolean
  onRefresh: () => void
}

export function LogToolbar({
  search,
  onSearchChange,
  severityFilter,
  onSeverityFilterChange,
  density,
  onDensityChange,
  viewMode,
  onViewModeChange,
  totalCount,
  filteredCount,
  isLoading,
  isRefreshing,
  onRefresh,
}: LogToolbarProps) {
  const searchRef = useRef<HTMLInputElement>(null)

  // Keyboard shortcut: `/` to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchRef.current) {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const toggleSeverity = (band: SeverityBand) => {
    if (severityFilter.includes(band)) {
      onSeverityFilterChange(severityFilter.filter((b) => b !== band))
    } else {
      onSeverityFilterChange([...severityFilter, band])
    }
  }

  const allSelected = severityFilter.length === ALL_BANDS.length

  return (
    <div className="flex flex-col gap-2 px-4 py-3 border-b border-border bg-background">
      {/* Row 1: search + controls */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search logs…"
            className="w-full h-8 pl-8 pr-8 rounded-md border border-border bg-background text-[13px] font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition"
            aria-label="Search log messages"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Density toggle */}
        <div className="flex items-center rounded-md border border-border overflow-hidden">
          <button
            onClick={() => onDensityChange('condensed')}
            className={`flex items-center justify-center h-8 w-8 transition-colors ${
              density === 'condensed'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Condensed rows"
            aria-pressed={density === 'condensed'}
          >
            <Rows3 size={14} />
          </button>
          <button
            onClick={() => onDensityChange('expanded')}
            className={`flex items-center justify-center h-8 w-8 transition-colors ${
              density === 'expanded'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Expanded rows"
            aria-pressed={density === 'expanded'}
          >
            <Rows4 size={14} />
          </button>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center rounded-md border border-border overflow-hidden">
          <button
            onClick={() => onViewModeChange('flat')}
            className={`flex items-center justify-center h-8 w-8 transition-colors ${
              viewMode === 'flat'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Flat chronological list"
            aria-pressed={viewMode === 'flat'}
          >
            <LayoutList size={14} />
          </button>
          <button
            onClick={() => onViewModeChange('grouped')}
            className={`flex items-center justify-center h-8 w-8 transition-colors ${
              viewMode === 'grouped'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Group by service"
            aria-pressed={viewMode === 'grouped'}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden="true"
              className="shrink-0"
            >
              <rect x="1" y="2" width="12" height="2" rx="1" fill="currentColor" />
              <rect x="3" y="6" width="10" height="1.5" rx="0.75" fill="currentColor" opacity="0.7" />
              <rect x="3" y="9" width="10" height="1.5" rx="0.75" fill="currentColor" opacity="0.7" />
              <rect x="3" y="11.5" width="7" height="1.5" rx="0.75" fill="currentColor" opacity="0.4" />
            </svg>
          </button>
        </div>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center justify-center h-8 w-8 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:pointer-events-none"
          title="Refresh logs"
          aria-label="Refresh logs"
        >
          <RefreshCw size={14} className={isLoading || isRefreshing ? 'animate-spin' : ''} />
        </button>

        {/* Count */}
        <span className="text-[12px] font-mono text-muted-foreground whitespace-nowrap tabular-nums">
          {filteredCount === totalCount
            ? `${totalCount.toLocaleString()} logs`
            : `${filteredCount.toLocaleString()} / ${totalCount.toLocaleString()}`}
        </span>
      </div>

      {/* Row 2: severity filters */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() =>
            onSeverityFilterChange(allSelected ? [] : [...ALL_BANDS])
          }
          className={`h-6 px-2 rounded text-[11px] font-medium border transition-colors flex items-center justify-center ${
            allSelected
              ? 'bg-muted border-border text-foreground'
              : 'border-border/50 text-muted-foreground hover:text-foreground'
          }`}
        >
          All
        </button>
        {ALL_BANDS.map((band) => (
          <button
            key={band}
            onClick={() => toggleSeverity(band)}
            className={`h-6 px-2 rounded border transition-colors flex items-center justify-center ${
              severityFilter.includes(band)
                ? 'bg-muted border-border'
                : 'border-border/50 opacity-50 hover:opacity-80'
            }`}
            aria-pressed={severityFilter.includes(band)}
          >
            <SeverityBadge band={band} compact />
          </button>
        ))}
      </div>
    </div>
  )
}
