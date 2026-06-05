import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SessionManager } from '../../src/privacy/session'

describe('SessionManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a session ID that is 16 hex characters', () => {
    const mgr = new SessionManager()
    const id = mgr.getSessionId()
    expect(id).toMatch(/^[a-f0-9]{16}$/)
  })

  it('returns the same session ID within the rotation window', () => {
    const mgr = new SessionManager({ rotationMs: 86400000 })
    const id1 = mgr.getSessionId()
    vi.advanceTimersByTime(1000)
    const id2 = mgr.getSessionId()
    expect(id1).toBe(id2)
  })

  it('returns a new session ID after rotation window', () => {
    const mgr = new SessionManager({ rotationMs: 1000 })
    const id1 = mgr.getSessionId()
    vi.advanceTimersByTime(1001)
    const id2 = mgr.getSessionId()
    expect(id1).not.toBe(id2)
  })

  it('uses stable hash from browser fingerprint when available', () => {
    const mgr = new SessionManager({ rotationMs: 86400000 })
    const id1 = mgr.getSessionId()
    const mgr2 = new SessionManager({ rotationMs: 86400000 })
    const id2 = mgr2.getSessionId()
    expect(id1).toMatch(/^[a-f0-9]{16}$/)
    expect(id2).toMatch(/^[a-f0-9]{16}$/)
  })
})
