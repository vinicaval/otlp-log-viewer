import type { SeverityBand } from '@/lib/otlp-types'

interface SeverityBadgeProps {
  band: SeverityBand
  text?: string
  compact?: boolean
}

const BAND_STYLES: Record<SeverityBand, { dot: string; text: string; label: string }> = {
  TRACE: {
    dot: 'bg-slate-400 dark:bg-slate-500',
    text: 'text-slate-500 dark:text-slate-400',
    label: 'TRACE',
  },
  DEBUG: {
    dot: 'bg-sky-400/80 dark:bg-sky-500/70',
    text: 'text-sky-600 dark:text-sky-400',
    label: 'DEBUG',
  },
  INFO: {
    dot: 'bg-cyan-400/80 dark:bg-cyan-500/70',
    text: 'text-cyan-600 dark:text-cyan-400',
    label: 'INFO',
  },
  WARN: {
    dot: 'bg-amber-400/80 dark:bg-amber-500/70',
    text: 'text-amber-600 dark:text-amber-400',
    label: 'WARN',
  },
  ERROR: {
    dot: 'bg-rose-400/80 dark:bg-rose-500/70',
    text: 'text-rose-600 dark:text-rose-400',
    label: 'ERROR',
  },
  FATAL: {
    dot: 'bg-fuchsia-400/80 dark:bg-fuchsia-500/70',
    text: 'text-fuchsia-600 dark:text-fuchsia-400',
    label: 'FATAL',
  },
}

export function SeverityBadge({ band, text, compact = false }: SeverityBadgeProps) {
  const styles = BAND_STYLES[band]
  const label = text || styles.label

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono tabular-nums select-none ${
        compact ? 'text-[11px]' : 'text-[12px]'
      }`}
      aria-label={`Severity: ${label}`}
    >
      <span
        className={`shrink-0 rounded-full ${compact ? 'size-1.5' : 'size-2'} ${styles.dot}`}
        aria-hidden="true"
      />
      <span className={`font-semibold tracking-wide ${styles.text}`}>{label}</span>
    </span>
  )
}

// Severity color values for chart use (must be plain strings, not Tailwind classes)
export const SEVERITY_CHART_COLORS: Record<SeverityBand, string> = {
  TRACE: '#94a3b8', // slate-400
  DEBUG: '#38bdf8', // sky-400
  INFO: '#22d3ee',  // cyan-400
  WARN: '#fbbf24',  // amber-400
  ERROR: '#fb7185', // rose-400
  FATAL: '#e879f9', // fuchsia-400
}
