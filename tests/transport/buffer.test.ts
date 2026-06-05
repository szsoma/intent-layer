import { describe, it, expect } from 'vitest'
import { EventBuffer } from '../../src/transport/buffer'
import type { BehavioralEvent } from '../../src/core/types'

function makeEvent(type: string, i: number): BehavioralEvent {
  return {
    sessionId: 'test',
    timestamp: performance.now(),
    type: type as BehavioralEvent['type'],
    url: '/test',
    data: { index: i },
  }
}

describe('EventBuffer', () => {
  it('stores and retrieves events', () => {
    const buf = new EventBuffer({ maxSize: 50 })
    const event = makeEvent('click', 1)
    buf.push(event)
    expect(buf.flush()).toEqual([event])
  })

  it('flushes all events and clears the buffer', () => {
    const buf = new EventBuffer({ maxSize: 50 })
    buf.push(makeEvent('click', 1))
    buf.push(makeEvent('scroll', 2))
    buf.flush()
    expect(buf.flush()).toEqual([])
  })

  it('drops oldest events when buffer exceeds maxSize', () => {
    const buf = new EventBuffer({ maxSize: 3 })
    buf.push(makeEvent('click', 1))
    buf.push(makeEvent('click', 2))
    buf.push(makeEvent('click', 3))
    buf.push(makeEvent('click', 4))

    const events = buf.flush()
    expect(events).toHaveLength(3)
    expect(events[0].data.index).toBe(2)
  })

  it('reports correct size', () => {
    const buf = new EventBuffer({ maxSize: 50 })
    expect(buf.size).toBe(0)
    buf.push(makeEvent('click', 1))
    expect(buf.size).toBe(1)
  })

  it('returns empty array when flushing empty buffer', () => {
    const buf = new EventBuffer({ maxSize: 50 })
    expect(buf.flush()).toEqual([])
  })
})
