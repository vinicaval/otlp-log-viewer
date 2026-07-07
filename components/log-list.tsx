'use client'

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type KeyboardEvent,
} from 'react'
import type { FlatLogRecord } from '@/lib/otlp-types'
import { SeverityBadge } from './severity-badge'
import { LogRowDetail } from './log-row-detail'
import { formatRelativeTime, formatAbsoluteTime } from '@/lib/otlp-utils'
import type { DensityMode } from './log-toolbar'
import { ChevronRight } from 'lucide-react'

interface LogListProps {
  logs: FlatLogRecord[]
  density: DensityMode
}

const ROW_HEIGHT_CONDENSED = 32
const ROW_HEIGHT_EXPANDED = 44

function TimestampCell({ date }: { date: Date }) {
  const [showAbsolute, setShowAbsolute] = useState(false)
  return (
    <span
      className="font-mono text-[12px] tabular-nums text-muted-foreground whitespace-nowrap cursor-default select-all"
      title={formatAbsoluteTime(date)}
      onMouseEnter={() => setShowAbsolute(true)}
      onMouseLeave={() => setShowAbsolute(false)}
    >
      {showAbsolute ? formatAbsoluteTime(date) : formatRelativeTime(date)}
    </span>
  )
}

function LogRow({
  log,
  isExpanded,
  isSelected,
  onToggle,
  density,
  index,
}: {
  log: FlatLogRecord
  isExpanded: boolean
  isSelected: boolean
  onToggle: () => void
  density: DensityMode
  index: number
}) {
  const rowRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggle()
    }
  }

  return (
    <div
      ref={rowRef}
      data-log-index={index}
      className={`border-b border-border transition-colors ${
        isSelected ? 'bg-muted/40' : 'hover:bg-muted/20'
      }`}
    >
      {/* Collapsed row */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
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
        <div className="w-[100px] shrink-0">
          <SeverityBadge band={log.severityBand} text={log.severityText} compact />
        </div>

        {/* Timestamp */}
        <div className="w-[88px] shrink-0">
          <TimestampCell date={log.timestamp} />
        </div>

        {/* Service pill */}
        {log.serviceName && (
          <span className="hidden sm:inline-block shrink-0 font-mono text-[11px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5 whitespace-nowrap max-w-[120px] truncate">
            {log.serviceNamespace
              ? `${log.serviceNamespace}/${log.serviceName}`
              : log.serviceName}
          </span>
        )}

        {/* Body */}
        <span
          className={`font-mono text-[13px] text-foreground/90 min-w-0 truncate leading-snug ${
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

export function LogList({ logs, density }: LogListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedIdx, setSelectedIdx] = useState<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const toggleExpand = useCallback(
    (id: string, idx: number) => {
      setExpandedId((prev) => (prev === id ? null : id))
      setSelectedIdx(idx)
    },
    []
  )

  // Keyboard navigation: j/k / arrow keys, Esc to collapse
  useEffect(() => {
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
          scrollToIdx(next)
          return next
        })
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIdx((prev) => {
          const next = Math.max(prev - 1, 0)
          scrollToIdx(next)
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
  }, [logs, selectedIdx])

  function scrollToIdx(idx: number) {
    const el = containerRef.current?.querySelector(`[data-log-index="${idx}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  if (logs.length === 0) return null

  return (
    <div
      ref={containerRef}
      className="overflow-y-auto flex-1"
      role="list"
      aria-label="Log records"
    >
      {logs.map((log, idx) => (
        <LogRow
          key={log.id}
          log={log}
          isExpanded={expandedId === log.id}
          isSelected={selectedIdx === idx}
          onToggle={() => toggleExpand(log.id, idx)}
          density={density}
          index={idx}
        />
      ))}
    </div>
  )
}
