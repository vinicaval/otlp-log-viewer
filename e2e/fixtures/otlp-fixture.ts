// Deterministic OTLP payload used to mock `/api/logs` in e2e tests. The real
// upstream API returns fresh random data on every call, which is exactly
// wrong for e2e assertions — this fixture is hand-built so tests can assert
// on exact counts/content instead of "roughly some logs showed up".

const BASE_NS = 1704067200000000000n // 2024-01-01T00:00:00.000Z
const TEN_MIN_NS = 600_000_000_000n

function ns(offsetSteps: number): string {
  return (BASE_NS + BigInt(offsetSteps) * TEN_MIN_NS).toString()
}

function resource(serviceName: string, serviceNamespace: string) {
  return {
    attributes: [
      { key: 'service.name', value: { stringValue: serviceName } },
      { key: 'service.namespace', value: { stringValue: serviceNamespace } },
      { key: 'service.version', value: { stringValue: '1.0.0' } },
    ],
    droppedAttributesCount: 0,
  }
}

export const otlpFixture = {
  resourceLogs: [
    {
      resource: resource('checkout', 'commerce'),
      scopeLogs: [
        {
          scope: { name: 'mock', attributes: [] },
          logRecords: [
            {
              timeUnixNano: ns(0),
              observedTimeUnixNano: ns(0),
              severityNumber: 1,
              severityText: 'TRACE',
              body: { stringValue: 'cache warm-up completed' },
              attributes: [],
              droppedAttributesCount: 0,
            },
            {
              timeUnixNano: ns(1),
              observedTimeUnixNano: ns(1),
              severityNumber: 6,
              severityText: 'DEBUG',
              body: { stringValue: 'connection pool size: 12' },
              attributes: [],
              droppedAttributesCount: 0,
            },
            {
              timeUnixNano: ns(2),
              observedTimeUnixNano: ns(2),
              severityNumber: 9,
              severityText: 'INFO',
              body: { stringValue: 'order confirmed for cart zzframboyant-42' },
              attributes: [],
              droppedAttributesCount: 0,
            },
            {
              timeUnixNano: ns(3),
              observedTimeUnixNano: ns(3),
              severityNumber: 10,
              severityText: 'INFO',
              body: { stringValue: '{"event":"payment","status":"ok"}' },
              attributes: [],
              droppedAttributesCount: 0,
            },
            {
              timeUnixNano: ns(4),
              observedTimeUnixNano: ns(4),
              severityNumber: 14,
              severityText: 'WARN',
              body: { stringValue: 'retrying payment gateway request' },
              attributes: [],
              droppedAttributesCount: 0,
            },
          ],
        },
      ],
    },
    {
      resource: resource('auth', 'identity'),
      scopeLogs: [
        {
          scope: { name: 'mock', attributes: [] },
          logRecords: [
            {
              timeUnixNano: ns(5),
              observedTimeUnixNano: ns(5),
              severityNumber: 18,
              severityText: 'ERROR',
              body: { stringValue: 'invalid credentials for user 42' },
              attributes: [{ key: 'trace.id', value: { stringValue: 'deadbeefcafe0001' } }],
              droppedAttributesCount: 0,
            },
            {
              timeUnixNano: ns(6),
              observedTimeUnixNano: ns(6),
              severityNumber: 19,
              severityText: 'ERROR',
              body: { stringValue: 'token refresh failed' },
              attributes: [],
              droppedAttributesCount: 0,
            },
            {
              timeUnixNano: ns(7),
              observedTimeUnixNano: ns(7),
              severityNumber: 22,
              severityText: 'FATAL',
              body: { stringValue: 'database connection pool exhausted' },
              attributes: [],
              droppedAttributesCount: 0,
            },
            {
              timeUnixNano: ns(8),
              observedTimeUnixNano: ns(8),
              severityNumber: 0,
              severityText: '',
              body: { stringValue: 'unrecognized event type' },
              attributes: [],
              droppedAttributesCount: 0,
            },
            {
              timeUnixNano: ns(9),
              observedTimeUnixNano: ns(9),
              severityNumber: 9,
              severityText: 'INFO',
              body: { stringValue: 'session created' },
              attributes: [],
              droppedAttributesCount: 0,
            },
          ],
        },
      ],
    },
  ],
}

export const TOTAL_LOG_COUNT = 10
