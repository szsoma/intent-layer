import type { EventType, BehavioralEvent } from './types'

type EventHandler = (event: BehavioralEvent) => void

export class EventBus {
  private handlers: Map<EventType, Set<EventHandler>> = new Map()
  private sessionId: string

  constructor(sessionId: string) {
    this.sessionId = sessionId
  }

  on(type: EventType, handler: EventHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler)
  }

  off(type: EventType, handler: EventHandler): void {
    this.handlers.get(type)?.delete(handler)
  }

  emit(type: EventType, data: Record<string, number | string | boolean>): void {
    const event: BehavioralEvent = {
      sessionId: this.sessionId,
      timestamp: performance.now(),
      type,
      url: typeof location !== 'undefined' ? location.pathname : '',
      data,
    }
    this.handlers.get(type)?.forEach((handler) => {
      try {
        handler(event)
      } catch {
        // Swallow handler errors
      }
    })
  }

  updateSession(sessionId: string): void {
    this.sessionId = sessionId
  }
}
