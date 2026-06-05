// tests/privacy/consent.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ConsentGate } from '../../src/privacy/consent'

describe('ConsentGate', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('allows tracking when DNT is not set and respectDNT is true', () => {
    vi.stubGlobal('navigator', { doNotTrack: null })
    const gate = new ConsentGate({ respectDNT: true })
    expect(gate.canTrack()).toBe(true)
  })

  it('blocks tracking when DNT is 1 and respectDNT is true', () => {
    vi.stubGlobal('navigator', { doNotTrack: '1' })
    const gate = new ConsentGate({ respectDNT: true })
    expect(gate.canTrack()).toBe(false)
  })

  it('allows tracking when DNT is 1 but respectDNT is false', () => {
    vi.stubGlobal('navigator', { doNotTrack: '1' })
    const gate = new ConsentGate({ respectDNT: false })
    expect(gate.canTrack()).toBe(true)
  })

  it('allows tracking by default (respectDNT defaults to true, DNT defaults to off)', () => {
    vi.stubGlobal('navigator', { doNotTrack: null })
    const gate = new ConsentGate()
    expect(gate.canTrack()).toBe(true)
  })
})
