'use client'

import { useState, useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import type { FlatLogRecord, SeverityBand } from '@/lib/otlp-types'
import { SeverityBadge } from './severity-badge'
import { LogList } from './log-list'
import type { DensityMode } from './log-toolbar'

interface ServiceGroup {
  key: string
  serviceName: string
  serviceNamespace: string
  logs: FlatLogRecord[]
  severityCounts: Record<SeverityBand, number>
}

function buildGroups(logs: FlatLogRecord[]): ServiceGroup[] {
  const map = new Map<string, ServiceGroup>()

  for (const log of logs) {
    const key = `${log.serviceNamespace}::${log.serviceName}` || 'unknown'
    if (!map.has(key)) {
      map.set(key, {
        key,
        serviceName: log.serviceName || 'unknown',
        serviceNamespace: log.serviceNamespace,
        logs: [],
        severityCounts: { TRACE: 0, DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0, FATAL: 0 },
      })
    }
    const group = map.get(key)!
    group.logs.push(log)
    group.severityCounts[log.severityBand]++
  }

  // Sort groups by error count desc, then total desc
  return Array.from(map.values()).sort(
    (a, b) =>
      b.severityCounts.ERROR + b.severityCounts.FATAL -
      (a.severityCounts.ERROR + a.severityCounts.FATAL) ||
      b.logs.length - a.logs.length
  )
}

const BADGE_BANDS: SeverityBand[] = ['FATAL', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE']

function SeverityCountBar({
  counts,
}: {
  counts: Record<SeverityBand, number>
}) {
  const bands = BADGE_BANDS.filter((b) => counts[b] > 0)
  if (bands.length === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {bands.map((band) => (
        <span key={band} className="flex items-center gap-1">
          <SeverityBadge band={band} compact />
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {counts[band]}
          </span>
        </span>
      ))}
    </div>
  )
}

function ServiceGroupPanel({
  group,
  density,
}: {
  group: ServiceGroup
  density: DensityMode
}) {
  const [open, setOpen] = useState(true)
  const displayName = group.serviceNamespace
    ? `${group.serviceNamespace} / ${group.serviceName}`
    : group.serviceName

  return (
    <div className="border-b border-border last:border-0">
      {/* Group header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors text-left"
        aria-expanded={open}
      >
        <ChevronRight
          size={13}
          className={`shrink-0 text-muted-foreground/50 transition-transform duration-150 ${
            open ? 'rotate-90' : ''
          }`}
          aria-hidden
        />
        <span className="font-mono text-[13px] font-semibold text-foreground">
          {displayName}
        </span>
        <span className="ml-1 font-mono text-[11px] text-muted-foreground tabular-nums bg-muted rounded px-1.5 py-0.5">
          {group.logs.length}
        </span>
        <div className="ml-auto">
          <SeverityCountBar counts={group.severityCounts} />
        </div>
      </button>

      {/* Nested log list */}
      {open && (
        <div className="border-t border-border bg-background/50">
          <LogList logs={group.logs} density={density} enableKeyboardNav={false} />
        </div>
      )}
    </div>
  )
}

interface LogGroupedViewProps {
  logs: FlatLogRecord[]
  density: DensityMode
}

export function LogGroupedView({ logs, density }: LogGroupedViewProps) {
  const groups = useMemo(() => buildGroups(logs), [logs])

  return (
    <div className="overflow-y-auto flex-1" role="list" aria-label="Logs grouped by service">
      {groups.map((group) => (
        <ServiceGroupPanel key={group.key} group={group} density={density} />
      ))}
    </div>
  )
}
