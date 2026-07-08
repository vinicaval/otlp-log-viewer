import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebouncedValue } from './use-debounced-value'

describe('useDebouncedValue', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('a', 200))
    expect(result.current).toBe('a')
  })

  it('does not update until the delay elapses', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 200),
      { initialProps: { value: 'a' } }
    )

    rerender({ value: 'b' })
    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(199)
    })
    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe('b')
  })

  it('collapses rapid successive updates into a single trailing value', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 200),
      { initialProps: { value: 'a' } }
    )

    rerender({ value: 'ab' })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    rerender({ value: 'abc' })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    // Only 100ms since the *last* change — the earlier pending timer should
    // have been cleared, not fired.
    expect(result.current).toBe('a')

    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current).toBe('abc')
  })
})
