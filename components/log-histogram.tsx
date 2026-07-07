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

function formatBucketLabel(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCHours().toString().padStart(2, '0')}:${d
    .getUTCMinutes()
    .toString()
    .padStart(2, '0')}:${d.getUTCSeconds().toString().padStart(2, '0')}`
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; fill: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  const total = payload.reduce((sum, p) => sum + (p.value || 0), 0)

  return (
    <div className="rounded-md border border-border bg-popover p-2.5 shadow-md text-[12px] font-mono min-w-[140px]">
      <p className="text-muted-foreground mb-1.5 text-[11px]">{label}</p>
      {payload
        .filter((p) => p.value > 0)
        .map((p) => (
          <div key={p.name} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block size-2 rounded-full"
                style={{ background: p.fill }}
              />
              <span className="text-muted-foreground">{p.name}</span>
            </span>
            <span className="tabular-nums text-foreground">{p.value}</span>
          </div>
        ))}
      <div className="mt-1.5 pt-1.5 border-t border-border flex justify-between">
        <span className="text-muted-foreground">total</span>
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
      if (!e?.activeLabel) return
      const label = String(e.activeLabel)
      const idx = buckets.findIndex((b) => formatBucketLabel(b.startMs) === label)
      if (idx === -1) return
      setSelectionStart(idx)
      setSelectionCurrent(idx)
      setIsDragging(true)
    },
    [buckets]
  )

  const handleMouseMove = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => {
      if (!isDragging || !e?.activeLabel) return
      const label = String(e.activeLabel)
      const idx = buckets.findIndex((b) => formatBucketLabel(b.startMs) === label)
      if (idx === -1) return
      setSelectionCurrent(idx)
    },
    [isDragging, buckets]
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

  // Reference area bounds
  const refStart =
    selectionStart !== null && selectionCurrent !== null
      ? formatBucketLabel(buckets[Math.min(selectionStart, selectionCurrent)].startMs)
      : brushRange
        ? formatBucketLabel(buckets.find((b) => b.startMs <= brushRange[0] && b.endMs >= brushRange[0])?.startMs ?? brushRange[0])
        : undefined

  const refEnd =
    selectionStart !== null && selectionCurrent !== null
      ? formatBucketLabel(buckets[Math.max(selectionStart, selectionCurrent)].startMs)
      : brushRange
        ? formatBucketLabel(buckets.find((b) => b.startMs <= brushRange[1] && b.endMs >= brushRange[1])?.startMs ?? brushRange[1])
        : undefined

  const chartData = buckets.map((b) => ({
    label: formatBucketLabel(b.startMs),
    TRACE: b.trace,
    DEBUG: b.debug,
    INFO: b.info,
    WARN: b.warn,
    ERROR: b.error,
    FATAL: b.fatal,
  }))

  const bands = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] as const

  return (
    <div
      className="h-[120px] border-b border-border select-none"
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
            tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--color-muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} cursor={false} />
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
