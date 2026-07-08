import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  anyValueToString,
  kvListToRecord,
  severityNumberToBand,
  nanosToDate,
  detectJson,
  flattenLogs,
  buildHistogram,
  formatRelativeTime,
  formatAbsoluteTime,
} from './otlp-utils'
import type {
  OtlpExportLogsServiceRequest,
  OtlpKeyValue,
  OtlpLogRecord,
} from './otlp-types'

// ─── Fixture builders ──────────────────────────────────────────────────────

function kv(key: string, value: OtlpKeyValue['value']): OtlpKeyValue {
  return { key, value }
}

function logRecord(overrides: Partial<OtlpLogRecord> = {}): OtlpLogRecord {
  return {
    timeUnixNano: '1700000000000000000',
    observedTimeUnixNano: '1700000000000000000',
    severityNumber: 9,
    severityText: 'INFO',
    body: { stringValue: 'hello world' },
    attributes: [],
    droppedAttributesCount: 0,
    ...overrides,
  }
}

function payload(
  logRecords: OtlpLogRecord[],
  opts: {
    resourceAttrs?: OtlpKeyValue[]
    scopeAttrs?: OtlpKeyValue[]
    scopeName?: string
  } = {}
): OtlpExportLogsServiceRequest {
  return {
    resourceLogs: [
      {
        resource: {
          attributes: opts.resourceAttrs ?? [
            kv('service.name', { stringValue: 'checkout' }),
            kv('service.namespace', { stringValue: 'commerce' }),
            kv('service.version', { stringValue: '1.2.3' }),
          ],
          droppedAttributesCount: 0,
        },
        scopeLogs: [
          {
            scope: {
              name: opts.scopeName ?? 'mock',
              attributes: opts.scopeAttrs ?? [],
            },
            logRecords,
          },
        ],
      },
    ],
  }
}

// ─── anyValueToString ───────────────────────────────────────────────────────

describe('anyValueToString', () => {
  it('reads stringValue', () => {
    expect(anyValueToString({ stringValue: 'hi' })).toBe('hi')
  })

  it('reads intValue', () => {
    expect(anyValueToString({ intValue: 42 })).toBe('42')
  })

  it('reads doubleValue', () => {
    expect(anyValueToString({ doubleValue: 3.14 })).toBe('3.14')
  })

  it('reads boolValue, including false', () => {
    expect(anyValueToString({ boolValue: true })).toBe('true')
    expect(anyValueToString({ boolValue: false })).toBe('false')
  })

  it('reads bytesValue', () => {
    expect(anyValueToString({ bytesValue: 'aGVsbG8=' })).toBe('aGVsbG8=')
  })

  it('serializes arrayValue as a JSON array of its stringified elements', () => {
    const result = anyValueToString({
      arrayValue: { values: [{ stringValue: 'a' }, { intValue: 1 }] },
    })
    expect(JSON.parse(result)).toEqual(['a', '1'])
  })

  it('serializes kvlistValue as a JSON object', () => {
    const result = anyValueToString({
      kvlistValue: { values: [kv('nested', { stringValue: 'v' })] },
    })
    expect(JSON.parse(result)).toEqual({ nested: 'v' })
  })

  it('returns empty string when no variant is set', () => {
    expect(anyValueToString({})).toBe('')
  })

  it('numeric 0 is not treated as absent (falsy trap)', () => {
    expect(anyValueToString({ intValue: 0 })).toBe('0')
    expect(anyValueToString({ doubleValue: 0 })).toBe('0')
  })
})

// ─── kvListToRecord ─────────────────────────────────────────────────────────

describe('kvListToRecord', () => {
  it('converts a key-value list into a plain record', () => {
    const result = kvListToRecord([
      kv('http.method', { stringValue: 'GET' }),
      kv('http.status_code', { intValue: 200 }),
    ])
    expect(result).toEqual({ 'http.method': 'GET', 'http.status_code': '200' })
  })

  it('returns an empty object for an empty list', () => {
    expect(kvListToRecord([])).toEqual({})
  })

  it('later duplicate keys overwrite earlier ones', () => {
    const result = kvListToRecord([
      kv('k', { stringValue: 'first' }),
      kv('k', { stringValue: 'second' }),
    ])
    expect(result.k).toBe('second')
  })
})

// ─── severityNumberToBand ───────────────────────────────────────────────────

describe('severityNumberToBand', () => {
  it.each([
    [1, 'TRACE'],
    [4, 'TRACE'],
    [5, 'DEBUG'],
    [8, 'DEBUG'],
    [9, 'INFO'],
    [12, 'INFO'],
    [13, 'WARN'],
    [16, 'WARN'],
    [17, 'ERROR'],
    [20, 'ERROR'],
    [21, 'FATAL'],
    [24, 'FATAL'],
  ])('maps severityNumber %i to %s', (n, expected) => {
    expect(severityNumberToBand(n)).toBe(expected)
  })

  it('maps 0 (OTLP "unspecified") to UNSPECIFIED, not INFO', () => {
    expect(severityNumberToBand(0)).toBe('UNSPECIFIED')
  })

  it('maps out-of-range values to UNSPECIFIED', () => {
    expect(severityNumberToBand(25)).toBe('UNSPECIFIED')
    expect(severityNumberToBand(-1)).toBe('UNSPECIFIED')
  })
})

// ─── nanosToDate ────────────────────────────────────────────────────────────

describe('nanosToDate', () => {
  it('converts a nanosecond timestamp string to the correct millisecond Date', () => {
    // 1700000000000000000 ns = 1700000000000 ms = 2023-11-14T22:13:20.000Z
    const d = nanosToDate('1700000000000000000')
    expect(d.toISOString()).toBe('2023-11-14T22:13:20.000Z')
  })

  it('does not lose precision for values beyond Number.MAX_SAFE_INTEGER', () => {
    // This value's nanosecond precision exceeds what a plain `Number(str) / 1e6`
    // conversion can represent exactly — the BigInt-based implementation must
    // still produce the correct millisecond value. A naive
    // `Number(nanoStr) / 1e6` rounds this specific value up to .577; the
    // correct BigInt-divided result truncates to .576.
    const nanoStr = '1700000000576999973'
    expect(nanosToDate(nanoStr).toISOString()).toBe('2023-11-14T22:13:20.576Z')
  })

  it('handles "0" as the epoch', () => {
    expect(nanosToDate('0').getTime()).toBe(0)
  })
})

// ─── detectJson ─────────────────────────────────────────────────────────────

describe('detectJson', () => {
  it('detects a valid JSON object body', () => {
    expect(detectJson('{"a":1}')).toBe(true)
  })

  it('detects a valid JSON array body', () => {
    expect(detectJson('[1,2,3]')).toBe(true)
  })

  it('tolerates surrounding whitespace', () => {
    expect(detectJson('  {"a":1}  ')).toBe(true)
  })

  it('rejects plain text', () => {
    expect(detectJson('user logged in')).toBe(false)
  })

  it('rejects malformed JSON that merely starts with a brace', () => {
    expect(detectJson('{not valid json')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(detectJson('')).toBe(false)
  })
})

// ─── flattenLogs ────────────────────────────────────────────────────────────

describe('flattenLogs', () => {
  it('extracts resource/scope/log fields onto the flat record', () => {
    const [record] = flattenLogs(payload([logRecord()]))

    expect(record.serviceName).toBe('checkout')
    expect(record.serviceNamespace).toBe('commerce')
    expect(record.serviceVersion).toBe('1.2.3')
    expect(record.scopeName).toBe('mock')
    expect(record.body).toBe('hello world')
    expect(record.severityBand).toBe('INFO')
    expect(record.severityText).toBe('INFO')
  })

  it('falls back severityText to the derived band when the API omits it', () => {
    const [record] = flattenLogs(
      payload([logRecord({ severityText: '', severityNumber: 18 })])
    )
    expect(record.severityText).toBe('ERROR')
  })

  it('detects a JSON body and flags bodyIsJson', () => {
    const [record] = flattenLogs(
      payload([logRecord({ body: { stringValue: '{"event":"db_query"}' } })])
    )
    expect(record.bodyIsJson).toBe(true)
  })

  it('falls back traceId/spanId to attributes["trace.id"]/["span.id"] when the OTLP wire fields are absent', () => {
    // The take-home's mock API never populates the top-level traceId/spanId
    // fields — it puts them under attributes instead. See PR #10.
    const [record] = flattenLogs(
      payload([
        logRecord({
          traceId: undefined,
          spanId: undefined,
          attributes: [
            kv('trace.id', { stringValue: 'abc123' }),
            kv('span.id', { stringValue: 'def456' }),
          ],
        }),
      ])
    )
    expect(record.traceId).toBe('abc123')
    expect(record.spanId).toBe('def456')
  })

  it('prefers the top-level traceId/spanId field over the attribute when both are present', () => {
    const [record] = flattenLogs(
      payload([
        logRecord({
          traceId: 'wire-trace',
          spanId: 'wire-span',
          attributes: [
            kv('trace.id', { stringValue: 'attr-trace' }),
            kv('span.id', { stringValue: 'attr-span' }),
          ],
        }),
      ])
    )
    expect(record.traceId).toBe('wire-trace')
    expect(record.spanId).toBe('wire-span')
  })

  it('leaves traceId/spanId empty when neither source has them', () => {
    const [record] = flattenLogs(payload([logRecord()]))
    expect(record.traceId).toBe('')
    expect(record.spanId).toBe('')
  })

  it('builds a lowercase searchHaystack covering body, service, and attribute values', () => {
    const [record] = flattenLogs(
      payload([
        logRecord({
          body: { stringValue: 'Payment DECLINED' },
          attributes: [kv('http.method', { stringValue: 'POST' })],
        }),
      ])
    )
    expect(record.searchHaystack).toContain('payment declined')
    expect(record.searchHaystack).toContain('checkout') // service.name
    expect(record.searchHaystack).toContain('post') // log attribute value
  })

  it('assigns a unique id to every record', () => {
    const records = flattenLogs(
      payload([logRecord(), logRecord(), logRecord()])
    )
    const ids = records.map((r) => r.id)
    expect(new Set(ids).size).toBe(3)
  })

  it('sorts the flattened records by timestamp ascending', () => {
    const records = flattenLogs(
      payload([
        logRecord({ timeUnixNano: '1700000000030000000' }),
        logRecord({ timeUnixNano: '1700000000010000000' }),
        logRecord({ timeUnixNano: '1700000000020000000' }),
      ])
    )
    const times = records.map((r) => r.timestamp.getTime())
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })

  it('flattens multiple resourceLogs/scopeLogs/logRecords into one array', () => {
    const data: OtlpExportLogsServiceRequest = {
      resourceLogs: [
        payload([logRecord(), logRecord()]).resourceLogs[0],
        payload([logRecord()], {
          resourceAttrs: [kv('service.name', { stringValue: 'billing' })],
        }).resourceLogs[0],
      ],
    }
    const records = flattenLogs(data)
    expect(records).toHaveLength(3)
    expect(records.filter((r) => r.serviceName === 'billing')).toHaveLength(1)
  })

  it('treats observedTimeUnixNano of "0" as absent', () => {
    const [record] = flattenLogs(
      payload([logRecord({ observedTimeUnixNano: '0' })])
    )
    expect(record.observedTimestamp).toBeNull()
  })

  it('returns an empty array for a payload with no resourceLogs', () => {
    expect(flattenLogs({ resourceLogs: [] })).toEqual([])
  })
})

// ─── buildHistogram ─────────────────────────────────────────────────────────

describe('buildHistogram', () => {
  it('returns an empty array for no logs', () => {
    expect(buildHistogram([], 30)).toEqual([])
  })

  it('buckets logs by time and counts severities per bucket', () => {
    const records = flattenLogs(
      payload([
        logRecord({ timeUnixNano: '1700000000000000000', severityNumber: 9 }), // INFO
        logRecord({ timeUnixNano: '1700000000000000000', severityNumber: 18 }), // ERROR
        logRecord({ timeUnixNano: '1700001000000000000', severityNumber: 9 }), // INFO, far later
      ])
    )
    const buckets = buildHistogram(records, 2)

    expect(buckets).toHaveLength(2)
    const totalAcrossBuckets = buckets.reduce((sum, b) => sum + b.total, 0)
    expect(totalAcrossBuckets).toBe(3)
    // first bucket holds the two logs sharing the earliest timestamp
    expect(buckets[0].total).toBe(2)
    expect(buckets[0].info).toBe(1)
    expect(buckets[0].error).toBe(1)
    // last bucket holds the later log
    expect(buckets[1].total).toBe(1)
    expect(buckets[1].info).toBe(1)
  })

  it('does not divide by zero when every log shares the same timestamp', () => {
    const records = flattenLogs(
      payload([logRecord(), logRecord(), logRecord()])
    )
    const buckets = buildHistogram(records, 5)
    const totalAcrossBuckets = buckets.reduce((sum, b) => sum + b.total, 0)
    expect(totalAcrossBuckets).toBe(3)
    expect(buckets.every((b) => Number.isFinite(b.startMs))).toBe(true)
  })

  it('counts UNSPECIFIED severity separately from INFO', () => {
    const records = flattenLogs(payload([logRecord({ severityNumber: 0, severityText: '' })]))
    const buckets = buildHistogram(records, 1)
    expect(buckets[0].unspecified).toBe(1)
    expect(buckets[0].info).toBe(0)
  })
})

// ─── formatRelativeTime / formatAbsoluteTime ───────────────────────────────

describe('formatRelativeTime', () => {
  const now = new Date('2026-01-01T12:00:00.000Z')

  afterEach(() => {
    vi.useRealTimers()
  })

  it('formats seconds', () => {
    vi.useFakeTimers().setSystemTime(now)
    const d = new Date(now.getTime() - 45 * 1000)
    expect(formatRelativeTime(d)).toBe('45s ago')
  })

  it('formats minutes', () => {
    vi.useFakeTimers().setSystemTime(now)
    const d = new Date(now.getTime() - 5 * 60 * 1000)
    expect(formatRelativeTime(d)).toBe('5m ago')
  })

  it('formats hours', () => {
    vi.useFakeTimers().setSystemTime(now)
    const d = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    expect(formatRelativeTime(d)).toBe('3h ago')
  })

  it('formats days', () => {
    vi.useFakeTimers().setSystemTime(now)
    const d = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
    expect(formatRelativeTime(d)).toBe('2d ago')
  })
})

describe('formatAbsoluteTime', () => {
  it('formats as "YYYY-MM-DD HH:MM:SS.mmm UTC"', () => {
    const d = new Date('2026-01-01T12:34:56.789Z')
    expect(formatAbsoluteTime(d)).toBe('2026-01-01 12:34:56.789 UTC')
  })
})
