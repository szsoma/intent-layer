import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VisibilityTracker } from '../../src/trackers/visibility.tracker'
import type { EventEmitFn } from '../../src/core/types'

describe('VisibilityTracker', () => {
  let emit: EventEmitFn
  let tracker: VisibilityTracker

  beforeEach(() => {
    emit = vi.fn()
    tracker = new VisibilityTracker()
  })

  it('has type "visibility"', () => {
    expect(tracker.type).toBe('visibility')
  })

  it('stops cleanly after stop()', () => {
    vi.stubGlobal('IntersectionObserver', class {
      observe = vi.fn()
      disconnect = vi.fn()
      unobserve = vi.fn()
      takeRecords = vi.fn().mockReturnValue([])
    })

    tracker.start(emit)
    tracker.stop()
    vi.unstubAllGlobals()
  })

  it('uses IntersectionObserver to track [data-intent] elements', () => {
    const observeSpy = vi.fn()
    const disconnectSpy = vi.fn()
    vi.stubGlobal('IntersectionObserver', class {
      observe = observeSpy
      disconnect = disconnectSpy
      unobserve = vi.fn()
      takeRecords = vi.fn().mockReturnValue([])
    })

    const el = document.createElement('section')
    el.setAttribute('data-intent', 'features')
    document.body.appendChild(el)

    tracker.start(emit)
    expect(observeSpy).toHaveBeenCalledWith(el)

    tracker.stop()
    document.body.removeChild(el)
    vi.unstubAllGlobals()
  })
})
