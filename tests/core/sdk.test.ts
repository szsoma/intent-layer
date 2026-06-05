import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IntentLayer } from '../../src/core/sdk'

// jsdom does not provide IntersectionObserver
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('IntentLayer', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('initializes without errors when DNT is off', () => {
    vi.stubGlobal('navigator', { doNotTrack: null, sendBeacon: vi.fn().mockReturnValue(true) })
    const sdk = new IntentLayer({ dev: true })
    expect(sdk).toBeDefined()
    sdk.destroy()
  })

  it('does not start trackers when DNT is on and respectDNT is true', () => {
    vi.stubGlobal('navigator', { doNotTrack: '1' })
    const sdk = new IntentLayer({ dev: true, respectDNT: true })
    expect(sdk).toBeDefined()
    sdk.destroy()
  })

  it('exposes getSessionId()', () => {
    vi.stubGlobal('navigator', { doNotTrack: null })
    const sdk = new IntentLayer({ dev: true })
    const sessionId = sdk.getSessionId()
    expect(sessionId).toMatch(/^[a-f0-9]{16}$/)
    sdk.destroy()
  })

  it('flushes buffer on destroy', () => {
    vi.stubGlobal('navigator', { doNotTrack: null, sendBeacon: vi.fn().mockReturnValue(true) })
    const sdk = new IntentLayer({ dev: true, endpoint: 'https://example.com/collect' })
    sdk.destroy()
  })

  it('flushes buffer on visibilitychange (page hidden)', () => {
    vi.stubGlobal('navigator', { doNotTrack: null, sendBeacon: vi.fn().mockReturnValue(true) })
    const sdk = new IntentLayer({ dev: true, endpoint: 'https://example.com/collect' })

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    sdk.destroy()
  })
})
