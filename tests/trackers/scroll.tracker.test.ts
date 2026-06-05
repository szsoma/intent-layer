import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ScrollTracker } from '../../src/trackers/scroll.tracker'
import type { EventEmitFn } from '../../src/core/types'

describe('ScrollTracker', () => {
  let emit: EventEmitFn
  let tracker: ScrollTracker

  beforeEach(() => {
    emit = vi.fn()
    tracker = new ScrollTracker()
  })

  it('has type "scroll"', () => {
    expect(tracker.type).toBe('scroll')
  })

  it('emits scroll events when page is scrolled', () => {
    tracker.start(emit)
    window.dispatchEvent(new Event('scroll'))
    tracker.stop()
  })

  it('stops listening after stop()', () => {
    tracker.start(emit)
    tracker.stop()

    const callsBefore = (emit as ReturnType<typeof vi.fn>).mock.calls.length
    window.dispatchEvent(new Event('scroll'))
    expect((emit as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsBefore)
  })
})
