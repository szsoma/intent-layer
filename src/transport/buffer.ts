import type { BehavioralEvent } from '../core/types'

export interface BufferConfig {
  /** Maximum events to hold before oldest are dropped. Default: 100 */
  maxSize?: number
}

export class EventBuffer {
  private queue: BehavioralEvent[] = []
  private readonly maxSize: number

  constructor(config: BufferConfig = {}) {
    this.maxSize = config.maxSize ?? 100
  }

  push(event: BehavioralEvent): void {
    this.queue.push(event)
    if (this.queue.length > this.maxSize) {
      this.queue.shift()
    }
  }

  flush(): BehavioralEvent[] {
    const events = this.queue
    this.queue = []
    return events
  }

  get size(): number {
    return this.queue.length
  }
}
