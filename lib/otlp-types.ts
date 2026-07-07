// OTLP Logs protobuf JSON types — strict, no `any`

export interface OtlpAnyValue {
  stringValue?: string
  intValue?: number
  doubleValue?: number
  boolValue?: boolean
  arrayValue?: { values: OtlpAnyValue[] }
  kvlistValue?: { values: OtlpKeyValue[] }
  bytesValue?: string
}

export interface OtlpKeyValue {
  key: string
  value: OtlpAnyValue
}

export interface OtlpResource {
  attributes: OtlpKeyValue[]
  droppedAttributesCount: number
}

export interface OtlpInstrumentationScope {
  name?: string
  version?: string
  attributes?: OtlpKeyValue[]
  droppedAttributesCount?: number
}

export interface OtlpLogRecord {
  timeUnixNano: string
  observedTimeUnixNano: string
  severityNumber: number
  severityText: string
  body: OtlpAnyValue
  attributes: OtlpKeyValue[]
  droppedAttributesCount: number
  traceId?: string
  spanId?: string
  flags?: number
}

export interface OtlpScopeLogs {
  scope: OtlpInstrumentationScope
  logRecords: OtlpLogRecord[]
}

export interface OtlpResourceLogs {
  resource: OtlpResource
  scopeLogs: OtlpScopeLogs[]
}

export interface OtlpExportLogsServiceRequest {
  resourceLogs: OtlpResourceLogs[]
}

// ─── Flattened / parsed log record for UI use ───────────────────────────────

export type SeverityBand = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'

export interface FlatLogRecord {
  id: string // synthetic key for React
  timestamp: Date
  severityNumber: number
  severityBand: SeverityBand
  severityText: string
  body: string
  bodyIsJson: boolean
  // resource
  serviceName: string
  serviceNamespace: string
  serviceVersion: string
  resourceAttributes: Record<string, string>
  // scope
  scopeName: string
  scopeAttributes: Record<string, string>
  // log attributes
  logAttributes: Record<string, string>
  droppedAttributesCount: number
}
