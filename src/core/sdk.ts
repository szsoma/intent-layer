import type { IntentLayerConfig, EventType, BehavioralEvent, Tracker } from './types'
import { EventBus } from './event-bus'
import { SessionManager } from '../privacy/session'
import { ConsentGate } from '../privacy/consent'
import { EventBuffer } from '../transport/buffer'
import { BeaconTransport } from '../transport/beacon'
import { LoggerTransport } from '../transport/logger'
import { PointerTracker } from '../trackers/pointer.tracker'
import { ScrollTracker } from '../trackers/scroll.tracker'
import { ClickTracker } from '../trackers/click.tracker'
import { VisibilityTracker } from '../trackers/visibility.tracker'
import { NavigationTracker } from '../trackers/navigation.tracker'

const ALL_TYPES: EventType[] = ['pointer', 'scroll', 'click', 'visibility', 'navigation']

export class IntentLayer {
  private config: Required<Omit<IntentLayerConfig, 'endpoint'>> & { endpoint: string }
  private sessionManager: SessionManager
  private consentGate: ConsentGate
  private eventBus: EventBus
  private buffer: EventBuffer
  private beacon: BeaconTransport
  private logger: LoggerTransport
  private trackers: Tracker[] = []
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private boundVisibilityChange: (() => void) | null = null

  constructor(config: IntentLayerConfig = {}) {
    this.config = {
      endpoint: config.endpoint ?? '',
      dev: config.dev ?? false,
      trackers: config.trackers ?? ALL_TYPES,
      sampleRate: config.sampleRate ?? 1,
      batchSize: config.batchSize ?? 20,
      flushInterval: config.flushInterval ?? 5000,
      sessionRotationMs: config.sessionRotationMs ?? 86400000,
      respectDNT: config.respectDNT ?? true,
    }

    this.sessionManager = new SessionManager({ rotationMs: this.config.sessionRotationMs })
    this.consentGate = new ConsentGate({ respectDNT: this.config.respectDNT })
    this.eventBus = new EventBus(this.sessionManager.getSessionId())
    this.buffer = new EventBuffer({ maxSize: this.config.batchSize * 5 })
    this.beacon = new BeaconTransport({ endpoint: this.config.endpoint || undefined })
    this.logger = new LoggerTransport({ enabled: this.config.dev })

    if (!this.consentGate.canTrack()) return

    this.initTrackers()
    this.initFlush()
    this.initVisibilityFlush()
  }

  getSessionId(): string {
    return this.sessionManager.getSessionId()
  }

  destroy(): void {
    this.flush()
    this.trackers.forEach((t) => t.stop())
    this.trackers = []
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    if (this.boundVisibilityChange) {
      document.removeEventListener('visibilitychange', this.boundVisibilityChange)
      this.boundVisibilityChange = null
    }
  }

  private initTrackers(): void {
    const trackerMap: Record<EventType, Tracker> = {
      pointer: new PointerTracker(),
      scroll: new ScrollTracker(),
      click: new ClickTracker(),
      visibility: new VisibilityTracker(),
      navigation: new NavigationTracker(),
    }

    // The emit function adapts between the standard EventEmitFn signature
    // and ClickTracker's non-standard single-object call: emit({ type, data })
    // We use a Proxy so ClickTracker's `emit({ type, data })` still works.
    const emit = (typeOrObj: EventType | { type: EventType; data: Record<string, number | string | boolean> }, data?: Record<string, number | string | boolean>): void => {
      let type: EventType
      let eventData: Record<string, number | string | boolean>

      if (typeof typeOrObj === 'object') {
        // ClickTracker-style call: emit({ type, data })
        type = typeOrObj.type
        eventData = typeOrObj.data
      } else {
        // Standard call: emit(type, data)
        type = typeOrObj
        eventData = data!
      }

      // Apply sampling to non-critical event types (skip click and navigation)
      if (type !== 'click' && type !== 'navigation' && Math.random() > this.config.sampleRate) return

      this.eventBus.updateSession(this.sessionManager.getSessionId())
      this.eventBus.emit(type, eventData)

      const event: BehavioralEvent = {
        sessionId: this.sessionManager.getSessionId(),
        timestamp: performance.now(),
        type,
        url: typeof location !== 'undefined' ? location.pathname : '',
        data: eventData,
      }
      this.buffer.push(event)

      if (this.buffer.size >= this.config.batchSize) {
        this.flush()
      }
    }

    for (const type of this.config.trackers) {
      const tracker = trackerMap[type]
      if (tracker) {
        tracker.start(emit as any)
        this.trackers.push(tracker)
      }
    }

    ALL_TYPES.forEach((type) => {
      this.eventBus.on(type, (event) => {
        this.logger.send([event])
      })
    })
  }

  private initFlush(): void {
    this.flushTimer = setInterval(() => this.flush(), this.config.flushInterval)
  }

  private initVisibilityFlush(): void {
    this.boundVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        this.flush()
      }
    }
    document.addEventListener('visibilitychange', this.boundVisibilityChange)
  }

  private flush(): void {
    const events = this.buffer.flush()
    if (events.length === 0) return
    this.beacon.send(events)
    this.logger.send(events)
  }
}
