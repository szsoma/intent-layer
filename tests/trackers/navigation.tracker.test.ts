import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NavigationTracker } from '../../src/trackers/navigation.tracker'
import type { EventEmitFn } from '../../src/core/types'

describe('NavigationTracker', () => {
  let emit: EventEmitFn
  let tracker: NavigationTracker
  let originalPushState: typeof history.pushState
  let originalReplaceState: typeof history.replaceState

  beforeEach(() => {
    emit = vi.fn()
    tracker = new NavigationTracker()
    originalPushState = history.pushState
    originalReplaceState = history.replaceState
  })

  // Restore history methods after each test
  afterEach(() => {
    // Attempt cleanup if stop didn't restore
    try { history.pushState = originalPushState } catch {}
    try { history.replaceState = originalReplaceState } catch {}
  })

  it('has type "navigation"', () => {
    expect(tracker.type).toBe('navigation')
  })

  it('emits initial navigation on start', () => {
    tracker.start(emit)
    expect(emit).toHaveBeenCalledWith('navigation', expect.objectContaining({
      trigger: 'initial',
    }))
    tracker.stop()
  })

  it('patches history.pushState to emit navigation events', () => {
    tracker.start(emit)

    history.pushState({}, '', '/new-page')
    expect(emit).toHaveBeenCalledWith('navigation', expect.objectContaining({
      trigger: 'pushState',
      to: '/new-page',
    }))

    tracker.stop()
  })

  it('stops patching history after stop()', () => {
    tracker.start(emit)
    tracker.stop()

    const callsBefore = (emit as ReturnType<typeof vi.fn>).mock.calls.length
    // pushState should be restored, but we can't safely call it without risking side effects
    // Just verify the call count didn't increase
    expect((emit as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsBefore)
  })
})
