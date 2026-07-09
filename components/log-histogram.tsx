'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts'
import { useState, useCallback } from 'react'
import type { HistogramBucket } from '@/lib/otlp-utils'
import { SEVERITY_CHART_COLORS } from './severity-badge'

interface LogHistogramProps {
  buckets: HistogramBucket[]
  brushRange: [number, number] | null
  onBrushChange: (range: [number, number] | null) => void
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

const HOUR_MS = 3600_000
const DAY_MS = 24 * HOUR_MS

function hhmm(d: Date): string {
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

// Compact, span-aware axis tick. For multi-day ranges each tick carries its
// own date (HH:MM alone would collide across day boundaries); for
// multi-hour ranges we drop seconds and show HH:MM; for short ranges we
// keep seconds so adjacent buckets stay distinguishable.
function formatAxisTick(ms: number, spanMs: number): string {
  const d = new Date(ms)
  if (spanMs >= DAY_MS) {
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} ${hhmm(d)}`
  }
  if (spanMs >= HOUR_MS) {
    return hhmm(d)
  }
  return `${hhmm(d)}:${pad(d.getUTCSeconds())}`
}

// Full, human-readable timestamp for the tooltip header.
function formatFullTimestamp(ms: number): string {
  const d = new Date(ms)
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${hhmm(d)}:${pad(d.getUTCSeconds())} UTC`
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; fill: string; payload?: { label: string; endMs: number } }>
  label?: string
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  const total = payload.reduce((sum, p) => sum + (p.value || 0), 0)
  const row = payload[0]?.payload
  const startMs = row ? Number(row.label) : NaN
  const endMs = row?.endMs

  return (
    <div className="rounded-lg border border-border bg-popover/95 backdrop-blur-sm p-3 shadow-lg text-[12px] font-mono min-w-[180px]">
      <div className="mb-2 pb-2 border-b border-border">
        <p className="text-foreground text-[12px] font-medium">
          {Number.isFinite(startMs) ? formatFullTimestamp(startMs) : ''}
        </p>
        {endMs !== undefined && Number.isFinite(endMs) ? (
          <p className="text-muted-foreground text-[10px] mt-0.5">
            {`until ${hhmm(new Date(endMs))}:${pad(new Date(endMs).getUTCSeconds())}`}
          </p>
        ) : null}
      </div>
      {payload
        .filter((p) => p.value > 0)
        .map((p) => (
          <div key={p.name} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block size-2 rounded-[3px]"
                style={{ background: p.fill }}
              />
              <span className="text-muted-foreground">{p.name}</span>
            </span>
            <span className="tabular-nums text-foreground">{p.value}</span>
          </div>
        ))}
      <div className="mt-2 pt-2 border-t border-border flex justify-between">
        <span className="text-muted-foreground">Total</span>
        <span className="tabular-nums font-semibold text-foreground">{total}</span>
      </div>
    </div>
  )
}

export function LogHistogram({ buckets, brushRange, onBrushChange }: LogHistogramProps) {
  const [selectionStart, setSelectionStart] = useState<number | null>(null)
  const [selectionCurrent, setSelectionCurrent] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleMouseDown = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => {
      // Recharts v3's activeTooltipIndex is a string (or null), not a number.
      const idx = Number(e?.activeTooltipIndex)
      if (!Number.isInteger(idx) || idx < 0 || idx >= buckets.length) return
      setSelectionStart(idx)
      setSelectionCurrent(idx)
      setIsDragging(true)
    },
    [buckets.length]
  )

  const handleMouseMove = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => {
      if (!isDragging) return
      const idx = Number(e?.activeTooltipIndex)
      if (!Number.isInteger(idx) || idx < 0 || idx >= buckets.length) return
      setSelectionCurrent(idx)
    },
    [isDragging, buckets.length]
  )

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)

    if (selectionStart === null || selectionCurrent === null) return
    const lo = Math.min(selectionStart, selectionCurrent)
    const hi = Math.max(selectionStart, selectionCurrent)

    if (lo === hi) {
      // single click = clear brush
      onBrushChange(null)
    } else {
      onBrushChange([buckets[lo].startMs, buckets[hi].endMs])
    }
    setSelectionStart(null)
    setSelectionCurrent(null)
  }, [isDragging, selectionStart, selectionCurrent, buckets, onBrushChange])

  // Reference area bounds — keyed by each bucket's unique startMs. With 30
  // buckets over a wide span, two buckets can render the same axis label
  // (see formatAxisTick), so the label text itself is not a safe key.
  const refStart =
    selectionStart !== null && selectionCurrent !== null
      ? String(buckets[Math.min(selectionStart, selectionCurrent)].startMs)
      : brushRange
        ? String(buckets.find((b) => b.startMs <= brushRange[0] && b.endMs >= brushRange[0])?.startMs ?? brushRange[0])
        : undefined

  const refEnd =
    selectionStart !== null && selectionCurrent !== null
      ? String(buckets[Math.max(selectionStart, selectionCurrent)].startMs)
      : brushRange
        ? String(buckets.find((b) => b.startMs <= brushRange[1] && b.endMs >= brushRange[1])?.startMs ?? brushRange[1])
        : undefined

  const chartData = buckets.map((b) => ({
    label: String(b.startMs),
    endMs: b.endMs,
    TRACE: b.trace,
    DEBUG: b.debug,
    INFO: b.info,
    WARN: b.warn,
    ERROR: b.error,
    FATAL: b.fatal,
    UNSPECIFIED: b.unspecified,
  }))

  const spanMs =
    buckets.length > 0 ? buckets[buckets.length - 1].endMs - buckets[0].startMs : 0

  const bands = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL', 'UNSPECIFIED'] as const

  return (
    <div
      className="relative z-20 h-[120px] border-b border-border select-none"
      aria-label="Log frequency histogram"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
          barCategoryGap={2}
          barGap={0}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ cursor: isDragging ? 'col-resize' : 'crosshair' }}
        >
          <XAxis
            dataKey="label"
            tickFormatter={(value) => formatAxisTick(Number(value), spanMs)}
            tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--color-muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            minTickGap={44}
            interval="preserveStartEnd"
          />
          <YAxis hide />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'var(--color-muted-foreground)', fillOpacity: 0.08 }}
            wrapperStyle={{ zIndex: 50, outline: 'none' }}
            allowEscapeViewBox={{ x: false, y: true }}
          />
          {bands.map((band) => (
            <Bar
              key={band}
              dataKey={band}
              stackId="a"
              fill={SEVERITY_CHART_COLORS[band]}
              isAnimationActive={false}
              maxBarSize={20}
            />
          ))}
          {refStart && refEnd && refStart !== refEnd && (
            <ReferenceArea
              x1={refStart}
              x2={refEnd}
              fill="var(--color-primary)"
              fillOpacity={0.08}
              stroke="var(--color-primary)"
              strokeOpacity={0.3}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
