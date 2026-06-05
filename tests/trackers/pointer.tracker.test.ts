import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PointerTracker } from '../../src/trackers/pointer.tracker'
import type { EventEmitFn } from '../../src/core/types'

describe('PointerTracker', () => {
  let emit: EventEmitFn
  let tracker: PointerTracker

  beforeEach(() => {
    emit = vi.fn()
    tracker = new PointerTracker()
  })

  it('has type "pointer"', () => {
    expect(tracker.type).toBe('pointer')
  })

  it('emits pointer events from mousemove', () => {
    tracker.start(emit)

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 200 }))
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 110, clientY: 210 }))

    tracker.stop()
  })

  it('stops listening after stop() is called', () => {
    tracker.start(emit)
    tracker.stop()

    const callCount = (emit as ReturnType<typeof vi.fn>).mock.calls.length
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 500 }))
    expect((emit as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCount)
  })
})
