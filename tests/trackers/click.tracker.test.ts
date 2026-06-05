import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClickTracker } from '../../src/trackers/click.tracker'
import type { EventEmitFn } from '../../src/core/types'

describe('ClickTracker', () => {
  let emit: EventEmitFn
  let tracker: ClickTracker

  beforeEach(() => {
    emit = vi.fn()
    tracker = new ClickTracker()
  })

  it('has type "click"', () => {
    expect(tracker.type).toBe('click')
  })

  it('emits click event with hold duration', () => {
    tracker.start(emit)

    const target = document.createElement('button')
    target.setAttribute('data-intent', 'cta-primary')
    document.body.appendChild(target)

    target.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 200, bubbles: true }))
    target.dispatchEvent(new MouseEvent('mouseup', { clientX: 100, clientY: 200, bubbles: true }))

    expect(emit).toHaveBeenCalled()
    const call = (emit as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c as [{ type: string }])[0]?.type === 'click'
    )
    expect(call).toBeDefined()

    document.body.removeChild(target)
    tracker.stop()
  })

  it('detects rage clicks (3+ clicks within 500ms on same element)', () => {
    tracker.start(emit)

    const target = document.createElement('div')
    target.setAttribute('data-intent', 'nav-link')
    document.body.appendChild(target)

    for (let i = 0; i < 4; i++) {
      target.dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 50, bubbles: true }))
      target.dispatchEvent(new MouseEvent('mouseup', { clientX: 50, clientY: 50, bubbles: true }))
    }

    const calls = (emit as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => (c as [{ data: { rage: boolean } }])[0]?.data?.rage === true
    )
    expect(calls.length).toBeGreaterThanOrEqual(1)

    document.body.removeChild(target)
    tracker.stop()
  })

  it('stops listening after stop()', () => {
    tracker.start(emit)
    tracker.stop()

    const callsBefore = (emit as ReturnType<typeof vi.fn>).mock.calls.length
    document.dispatchEvent(new MouseEvent('mousedown'))
    document.dispatchEvent(new MouseEvent('mouseup'))
    expect((emit as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsBefore)
  })
})
