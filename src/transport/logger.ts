// src/transport/logger.ts
import type { BehavioralEvent } from '../core/types'

export interface LoggerConfig {
  enabled: boolean
}

export class LoggerTransport {
  private enabled: boolean

  constructor(config: LoggerConfig) {
    this.enabled = config.enabled
  }

  send(events: BehavioralEvent[]): void {
    if (!this.enabled) return
    for (const event of events) {
      console.log(
        `[IntentLayer] ${event.type}`,
        event.data,
        `sessionId=${event.sessionId.slice(0, 8)}…`
      )
    }
  }
}
