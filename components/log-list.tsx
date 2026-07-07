'use client'

import { useState, useCallback, useEffect, type KeyboardEvent } from 'react'
import {
  List,
  useListRef,
  useDynamicRowHeight,
  type RowComponentProps,
} from 'react-window'
import type { FlatLogRecord } from '@/lib/otlp-types'
import { SeverityBadge } from './severity-badge'
import { LogRowDetail } from './log-row-detail'
import { formatRelativeTime, formatAbsoluteTime } from '@/lib/otlp-utils'
import type { DensityMode } from './log-toolbar'
import { ChevronRight } from 'lucide-react'

interface LogListProps {
  logs: FlatLogRecord[]
  density: DensityMode
  // LogGroupedView renders one LogList per expanded service group. Each
  // instance used to register its own document-level j/k/Enter/Esc listener
  // and own its own selection state, so with multiple groups expanded a
  // single keypress would move/expand a row in *every* group at once.
  // Keyboard nav is only meaningful for a single authoritative list, so it's
  // opt-in and only the top-level flat view enables it; grouped-view rows
  // remain fully clickable, just without the global hotkeys.
  enableKeyboardNav?: boolean
}

const ROW_HEIGHT_CONDENSED = 32
const ROW_HEIGHT_EXPANDED = 44

function TimestampCell({ date }: { date: Date }) {
  return (
    <span
      className="font-mono text-[12px] tabular-nums text-muted-foreground whitespace-nowrap cursor-default"
      title={formatAbsoluteTime(date)}
      // "Xs/Xm ago" is computed against Date.now(), which necessarily
      // differs by a few seconds between server render and client
      // hydration — this is expected drift, not a real mismatch to patch up.
      suppressHydrationWarning
    >
      {formatRelativeTime(date)}
    </span>
  )
}

interface LogRowProps {
  logs: FlatLogRecord[]
  expandedId: string | null
  selectedIdx: number
  density: DensityMode
  onToggle: (id: string, idx: number) => void
}

function LogRow({
  index,
  style,
  ariaAttributes,
  logs,
  expandedId,
  selectedIdx,
  density,
  onToggle,
}: RowComponentProps<LogRowProps>) {
  const log = logs[index]
  const isExpanded = expandedId === log.id
  const isSelected = selectedIdx === index

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggle(log.id, index)
    }
  }

  return (
    <div
      style={style}
      data-index={index}
      {...ariaAttributes}
      className={`border-b border-border transition-colors ${
        isSelected ? 'bg-muted/40' : 'hover:bg-muted/20'
      }`}
    >
      {/* Collapsed row */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onToggle(log.id, index)}
        onKeyDown={handleKeyDown}
        className={`flex items-center gap-3 px-4 cursor-pointer group ${
          density === 'condensed' ? 'py-1.5' : 'py-2.5'
        }`}
        aria-expanded={isExpanded}
        aria-label={`Log entry: ${log.severityBand} - ${log.body.slice(0, 80)}`}
      >
        {/* Expand chevron */}
        <div className="flex items-center justify-center w-5 h-5 shrink-0">
          <ChevronRight
            size={16}
            className={`text-muted-foreground/50 group-hover:text-muted-foreground transition-all duration-150 ${
              isExpanded ? 'rotate-90' : ''
            }`}
            aria-hidden
          />
        </div>

        {/* Severity */}
        <div className="w-[100px] shrink-0 flex items-center">
          <SeverityBadge band={log.severityBand} text={log.severityText} compact />
        </div>

        {/* Timestamp */}
        <div className="w-[88px] shrink-0 flex items-center">
          <TimestampCell date={log.timestamp} />
        </div>

        {/* Service pill */}
        {log.serviceName && (
          <span className="hidden sm:inline-flex sm:items-center shrink-0 font-mono text-[11px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5 whitespace-nowrap max-w-[120px] truncate">
            {log.serviceNamespace
              ? `${log.serviceNamespace}/${log.serviceName}`
              : log.serviceName}
          </span>
        )}

        {/* Body */}
        <span
          className={`font-mono text-[13px] text-foreground/90 min-w-0 truncate leading-tight ${
            density === 'expanded' ? 'line-clamp-2 whitespace-normal' : ''
          }`}
        >
          {log.body}
        </span>
      </div>

      {/* Expanded detail */}
      {isExpanded && <LogRowDetail log={log} />}
    </div>
  )
}

export function LogList({ logs, density, enableKeyboardNav = true }: LogListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedIdx, setSelectedIdx] = useState<number>(0)
  const listRef = useListRef(null)

  const defaultRowHeight = density === 'condensed' ? ROW_HEIGHT_CONDENSED : ROW_HEIGHT_EXPANDED
  // Row heights aren't known ahead of time — an expanded row's detail panel
  // varies with attribute/body content — so they're measured off the actual
  // rendered row elements rather than estimated.
  const dynamicRowHeight = useDynamicRowHeight({ defaultRowHeight, key: density })

  const toggleExpand = useCallback((id: string, idx: number) => {
    setExpandedId((prev) => (prev === id ? null : id))
    setSelectedIdx(idx)
  }, [])

  // Re-observe the currently rendered row elements on every render so newly
  // mounted/resized rows (e.g. a row that just expanded) get measured. This
  // effect's cleanup runs automatically before the next render's effect (and
  // on unmount), unobserving the previous batch first — this never leaks.
  useEffect(() => {
    const el = listRef.current?.element
    if (!el) return
    const rowElements = el.querySelectorAll('[data-index]')
    return dynamicRowHeight.observeRowElements(rowElements)
  })

  // Keyboard navigation: j/k / arrow keys, Esc to collapse
  useEffect(() => {
    if (!enableKeyboardNav) return

    const handler = (e: globalThis.KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.key === 'Escape') {
        setExpandedId(null)
        return
      }

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIdx((prev) => {
          const next = Math.min(prev + 1, logs.length - 1)
          listRef.current?.scrollToRow({ index: next, align: 'auto', behavior: 'smooth' })
          return next
        })
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx((prev) => {
          const next = Math.max(prev - 1, 0)
          listRef.current?.scrollToRow({ index: next, align: 'auto', behavior: 'smooth' })
          return next
        })
      } else if (e.key === 'Enter' || e.key === ' ') {
        const log = logs[selectedIdx]
        if (log) {
          e.preventDefault()
          setExpandedId((prev) => (prev === log.id ? null : log.id))
        }
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [logs, selectedIdx, enableKeyboardNav, listRef])

  if (logs.length === 0) return null

  return (
    <div className="flex-1 min-h-0" role="list" aria-label="Log records">
      <List
        listRef={listRef}
        rowComponent={LogRow}
        rowCount={logs.length}
        rowHeight={dynamicRowHeight}
        rowProps={{ logs, expandedId, selectedIdx, density, onToggle: toggleExpand }}
        overscanCount={8}
        className="h-full"
      />
    </div>
  )
}
