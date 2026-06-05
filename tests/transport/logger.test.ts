// tests/transport/logger.test.ts
import { describe, it, expect, vi } from 'vitest'
import { LoggerTransport } from '../../src/transport/logger'
import type { BehavioralEvent } from '../../src/core/types'

describe('LoggerTransport', () => {
  it('logs events to console when enabled', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const logger = new LoggerTransport({ enabled: true })

    const event: BehavioralEvent = {
      sessionId: 'abc',
      timestamp: 1000,
      type: 'click',
      url: '/pricing',
      data: { x: 100, y: 200 },
    }
    logger.send([event])

    expect(logSpy).toHaveBeenCalledTimes(1)
    expect(logSpy.mock.calls[0][0]).toContain('[IntentLayer]')
    logSpy.mockRestore()
  })

  it('does not log when disabled', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const logger = new LoggerTransport({ enabled: false })

    logger.send([{
      sessionId: 'abc', timestamp: 1000, type: 'click', url: '/', data: {},
    }])

    expect(logSpy).not.toHaveBeenCalled()
    logSpy.mockRestore()
  })
})
