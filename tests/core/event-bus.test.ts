import { describe, it, expect, vi } from 'vitest'
import { EventBus } from '../../src/core/event-bus'
import type { BehavioralEvent } from '../../src/core/types'

describe('EventBus', () => {
  it('calls subscriber when an event is emitted', () => {
    const bus = new EventBus('test-session')
    const handler = vi.fn()
    bus.on('pointer', handler)

    bus.emit('pointer', { x: 100, y: 200, velocity: 0.5, targetElement: 'none', targetDistance: 0 })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pointer', data: expect.objectContaining({ x: 100, y: 200 }) })
    )
  })

  it('does not call subscriber for different event types', () => {
    const bus = new EventBus('test-session')
    const handler = vi.fn()
    bus.on('pointer', handler)

    bus.emit('scroll', { scrollY: 500, velocity: 1.2, section: 'hero', sectionDwell: 0, scrollDepth: 500 })

    expect(handler).not.toHaveBeenCalled()
  })

  it('supports multiple subscribers on the same type', () => {
    const bus = new EventBus('test-session')
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    bus.on('click', handler1)
    bus.on('click', handler2)

    bus.emit('click', { x: 0, y: 0, targetElement: 'btn', holdMs: 80, approachDecel: false, rage: false, dead: false })

    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes when off is called', () => {
    const bus = new EventBus('test-session')
    const handler = vi.fn()
    bus.on('pointer', handler)
    bus.off('pointer', handler)

    bus.emit('pointer', { x: 0, y: 0, velocity: 0, targetElement: 'none', targetDistance: 0 })

    expect(handler).not.toHaveBeenCalled()
  })

  it('includes sessionId, timestamp, and url in emitted events', () => {
    const bus = new EventBus('test-session-123')
    const handler = vi.fn()
    bus.on('click', handler)

    bus.emit('click', { x: 10, y: 20, targetElement: 'cta', holdMs: 90, approachDecel: true, rage: false, dead: false })

    const event: BehavioralEvent = handler.mock.calls[0][0]
    expect(event.sessionId).toBe('test-session-123')
    expect(event.timestamp).toBeGreaterThan(0)
    expect(event.type).toBe('click')
    expect(typeof event.url).toBe('string')
  })
})
