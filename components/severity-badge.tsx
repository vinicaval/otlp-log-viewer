import type { SeverityBand } from '@/lib/otlp-types'

interface SeverityBadgeProps {
  band: SeverityBand
  text?: string
  compact?: boolean
}

const BAND_STYLES: Record<SeverityBand, { dot: string; text: string; label: string }> = {
  TRACE: {
    dot: 'bg-gray-400 dark:bg-gray-500',
    text: 'text-gray-500 dark:text-gray-400',
    label: 'TRACE',
  },
  DEBUG: {
    dot: 'bg-blue-400/80 dark:bg-blue-500/70',
    text: 'text-blue-600 dark:text-blue-400',
    label: 'DEBUG',
  },
  INFO: {
    dot: 'bg-green-400/80 dark:bg-green-500/70',
    text: 'text-green-600 dark:text-green-400',
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
  // severityNumber 0 (or out of the 1-24 range) per the OTLP spec — must read
  // as distinctly "unknown", never silently blended into a real severity level.
  UNSPECIFIED: {
    dot: 'bg-stone-400 dark:bg-stone-500',
    text: 'text-stone-600 dark:text-stone-400',
    label: 'UNSPECIFIED',
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
  TRACE: '#9ca3af', // gray-400
  DEBUG: '#60a5fa', // blue-400
  INFO: '#4ade80',  // green-400
  WARN: '#fbbf24',  // amber-400
  ERROR: '#fb7185', // rose-400
  FATAL: '#e879f9', // fuchsia-400
  UNSPECIFIED: '#a8a29e', // stone-400
}
