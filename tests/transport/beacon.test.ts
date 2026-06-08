// tests/transport/beacon.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { BeaconTransport } from '../../src/transport/beacon'
import type { BehavioralEvent } from '../../src/core/types'

const sampleEvent: BehavioralEvent = {
  sessionId: 'abc123',
  timestamp: 1000,
  type: 'click',
  url: '/pricing',
  data: { x: 100, y: 200 },
}

describe('BeaconTransport', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends events via fetch with keepalive when available', () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchSpy)

    const transport = new BeaconTransport({ endpoint: 'https://example.com/collect' })
    const result = transport.send([sampleEvent])

    expect(result).toBe(true)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][1].keepalive).toBe(true)
    expect(fetchSpy.mock.calls[0][1].method).toBe('POST')
  })

  it('falls back to sendBeacon when fetch unavailable', () => {
    vi.stubGlobal('fetch', undefined)
    const beaconSpy = vi.fn().mockReturnValue(true)
    vi.stubGlobal('navigator', { sendBeacon: beaconSpy })

    const transport = new BeaconTransport({ endpoint: 'https://example.com/collect' })
    const result = transport.send([sampleEvent])

    expect(result).toBe(true)
    expect(beaconSpy).toHaveBeenCalledTimes(1)
    expect(beaconSpy.mock.calls[0][0]).toBe('https://example.com/collect')
  })

  it('returns false when endpoint is not configured', () => {
    const transport = new BeaconTransport({ endpoint: undefined })
    const result = transport.send([sampleEvent])
    expect(result).toBe(false)
  })
})
