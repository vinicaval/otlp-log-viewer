import { describe, it, expect } from 'vitest'
import { parseActiveTooltipIndex } from './log-histogram'

describe('parseActiveTooltipIndex', () => {
  const bucketCount = 5

  it('accepts a numeric string index (Recharts v3 shape)', () => {
    expect(parseActiveTooltipIndex('0', bucketCount)).toBe(0)
    expect(parseActiveTooltipIndex('3', bucketCount)).toBe(3)
  })

  it('accepts a plain number index (Recharts v2 shape)', () => {
    expect(parseActiveTooltipIndex(2, bucketCount)).toBe(2)
  })

  it('rejects null/undefined (no active bucket)', () => {
    expect(parseActiveTooltipIndex(null, bucketCount)).toBeNull()
    expect(parseActiveTooltipIndex(undefined, bucketCount)).toBeNull()
  })

  it('rejects non-numeric strings', () => {
    expect(parseActiveTooltipIndex('foo', bucketCount)).toBeNull()
    expect(parseActiveTooltipIndex('', bucketCount)).toBeNull()
  })

  it('rejects out-of-range indices', () => {
    expect(parseActiveTooltipIndex('-1', bucketCount)).toBeNull()
    expect(parseActiveTooltipIndex(-1, bucketCount)).toBeNull()
    expect(parseActiveTooltipIndex('5', bucketCount)).toBeNull()
    expect(parseActiveTooltipIndex(5, bucketCount)).toBeNull()
  })

  it('rejects non-integer values', () => {
    expect(parseActiveTooltipIndex('1.5', bucketCount)).toBeNull()
    expect(parseActiveTooltipIndex(1.5, bucketCount)).toBeNull()
  })

  it('treats an empty bucket list as always out of range', () => {
    expect(parseActiveTooltipIndex('0', 0)).toBeNull()
  })
})
