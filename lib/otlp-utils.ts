import type {
  FlatLogRecord,
  OtlpAnyValue,
  OtlpExportLogsServiceRequest,
  OtlpKeyValue,
  SeverityBand,
} from './otlp-types'

// ─── Attribute helpers ────────────────────────────────────────────────────────

export function anyValueToString(v: OtlpAnyValue): string {
  if (v.stringValue !== undefined) return v.stringValue
  if (v.intValue !== undefined) return String(v.intValue)
  if (v.doubleValue !== undefined) return String(v.doubleValue)
  if (v.boolValue !== undefined) return String(v.boolValue)
  if (v.bytesValue !== undefined) return v.bytesValue
  if (v.arrayValue !== undefined)
    return JSON.stringify(v.arrayValue.values.map(anyValueToString))
  if (v.kvlistValue !== undefined) return JSON.stringify(kvListToRecord(v.kvlistValue.values))
  return ''
}

export function kvListToRecord(attrs: OtlpKeyValue[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const { key, value } of attrs) {
    out[key] = anyValueToString(value)
  }
  return out
}

// ─── Severity mapping (OTLP spec, severity numbers 1-24) ─────────────────────

export function severityNumberToBand(n: number): SeverityBand {
  if (n >= 1 && n <= 4) return 'TRACE'
  if (n >= 5 && n <= 8) return 'DEBUG'
  if (n >= 9 && n <= 12) return 'INFO'
  if (n >= 13 && n <= 16) return 'WARN'
  if (n >= 17 && n <= 20) return 'ERROR'
  if (n >= 21 && n <= 24) return 'FATAL'
  return 'INFO'
}

// ─── Nanosecond timestamp → Date (BigInt-safe) ───────────────────────────────

export function nanosToDate(nanoStr: string): Date {
  // Avoid floating point loss: divide string-wise using BigInt constructor (no literal suffix)
  const ms = BigInt(nanoStr) / BigInt(1_000_000)
  return new Date(Number(ms))
}

// ─── Body detection ───────────────────────────────────────────────────────────

export function detectJson(s: string): boolean {
  const trimmed = s.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false
  try {
    JSON.parse(trimmed)
    return true
  } catch {
    return false
  }
}

// ─── Full flattening pass ─────────────────────────────────────────────────────

let _idCounter = 0

export function flattenLogs(data: OtlpExportLogsServiceRequest): FlatLogRecord[] {
  const records: FlatLogRecord[] = []

  for (const rl of data.resourceLogs) {
    const resourceAttrs = kvListToRecord(rl.resource.attributes)
    const serviceName = resourceAttrs['service.name'] ?? ''
    const serviceNamespace = resourceAttrs['service.namespace'] ?? ''
    const serviceVersion = resourceAttrs['service.version'] ?? ''

    for (const sl of rl.scopeLogs) {
      const scopeAttrs = kvListToRecord(sl.scope.attributes ?? [])
      const scopeName = sl.scope.name ?? ''

      for (const lr of sl.logRecords) {
        const bodyStr = lr.body.stringValue ?? anyValueToString(lr.body)
        const timestamp = nanosToDate(lr.timeUnixNano)

        records.push({
          id: `log-${_idCounter++}`,
          timestamp,
          severityNumber: lr.severityNumber,
          severityBand: severityNumberToBand(lr.severityNumber),
          severityText: lr.severityText || severityNumberToBand(lr.severityNumber),
          body: bodyStr,
          bodyIsJson: detectJson(bodyStr),
          serviceName,
          serviceNamespace,
          serviceVersion,
          resourceAttributes: resourceAttrs,
          scopeName,
          scopeAttributes: scopeAttrs,
          logAttributes: kvListToRecord(lr.attributes),
          droppedAttributesCount: lr.droppedAttributesCount,
        })
      }
    }
  }

  // Sort by timestamp ascending
  records.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  return records
}

// ─── Histogram bucketing ──────────────────────────────────────────────────────

export interface HistogramBucket {
  startMs: number
  endMs: number
  label: string
  total: number
  trace: number
  debug: number
  info: number
  warn: number
  error: number
  fatal: number
}

export function buildHistogram(
  logs: FlatLogRecord[],
  bucketCount = 30
): HistogramBucket[] {
  if (logs.length === 0) return []

  const times = logs.map((l) => l.timestamp.getTime())
  const minT = Math.min(...times)
  const maxT = Math.max(...times)
  const span = maxT - minT || 1
  const bucketSize = span / bucketCount

  const buckets: HistogramBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    startMs: minT + i * bucketSize,
    endMs: minT + (i + 1) * bucketSize,
    label: new Date(minT + i * bucketSize).toISOString(),
    total: 0,
    trace: 0,
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
    fatal: 0,
  }))

  for (const log of logs) {
    const idx = Math.min(
      Math.floor((log.timestamp.getTime() - minT) / bucketSize),
      bucketCount - 1
    )
    buckets[idx].total++
    buckets[idx][log.severityBand.toLowerCase() as Lowercase<SeverityBand>]++
  }

  return buckets
}

// ─── Relative time formatting ─────────────────────────────────────────────────

export function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`
  const diffDay = Math.floor(diffHour / 24)
  return `${diffDay}d ago`
}

export function formatAbsoluteTime(date: Date): string {
  return date.toISOString().replace('T', ' ').replace('Z', ' UTC')
}
