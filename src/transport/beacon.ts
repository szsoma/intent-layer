import type { BehavioralEvent, TransportPayload } from '../core/types'

export interface BeaconConfig {
  endpoint?: string
}

export class BeaconTransport {
  private endpoint?: string

  constructor(config: BeaconConfig) {
    this.endpoint = config.endpoint
  }

  send(events: BehavioralEvent[]): boolean {
    if (!this.endpoint || events.length === 0) return false

    const payload: TransportPayload = {
      events,
      sessionId: events[0]?.sessionId ?? '',
      url: events[0]?.url ?? '',
      sentAt: Date.now(),
    }
    const body = JSON.stringify(payload)

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' })
      return navigator.sendBeacon(this.endpoint, blob)
    }

    if (typeof fetch !== 'undefined') {
      fetch(this.endpoint, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {})
      return true
    }

    return false
  }
}
