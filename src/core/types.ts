// ─── Events ───────────────────────────────────────────────────

export type EventType = 'pointer' | 'scroll' | 'click' | 'visibility' | 'navigation'

export interface BehavioralEvent {
  sessionId: string
  timestamp: number
  type: EventType
  url: string
  data: Record<string, number | string | boolean>
}

// ─── Pointer ──────────────────────────────────────────────────

export interface PointerData {
  x: number
  y: number
  velocity: number          // px/ms
  targetElement: string     // closest [data-intent] selector or 'none'
  targetDistance: number     // px to nearest [data-intent] element
}

// ─── Scroll ───────────────────────────────────────────────────

export interface ScrollData {
  scrollY: number
  velocity: number           // px/ms (positive = down)
  section: string            // current [data-intent] section name
  sectionDwell: number       // ms spent in current section
  scrollDepth: number        // max scrollY reached this session (px)
}

// ─── Click ────────────────────────────────────────────────────

export interface ClickData {
  x: number
  y: number
  targetElement: string      // closest [data-intent] selector or tag name
  holdMs: number              // mousedown-to-mouseup duration
  approachDecel: boolean      // was cursor decelerating before click?
  rage: boolean               // part of a rage-click sequence?
  dead: boolean               // clicked non-interactive element?
}

// ─── Visibility ───────────────────────────────────────────────

export interface VisibilityData {
  section: string             // [data-intent] section name
  visibleMs: number           // total ms this section has been visible
  intersectionRatio: number   // 0-1, how much of section is visible
  entered: boolean            // true = entered viewport, false = left
}

// ─── Navigation ───────────────────────────────────────────────

export interface NavigationData {
  from: string                // previous URL path
  to: string                  // new URL path
  trigger: 'pushState' | 'replaceState' | 'popstate' | 'initial'
}

// ─── Transport ────────────────────────────────────────────────

export type TransportStatus = 'idle' | 'sending' | 'failed'

export interface TransportPayload {
  events: BehavioralEvent[]
  sessionId: string
  url: string
  sentAt: number
}

// ─── SDK Config ───────────────────────────────────────────────

export interface IntentLayerConfig {
  /** Endpoint to POST event batches to. Omit for console-only mode. */
  endpoint?: string
  /** Enable dev mode (console logging, debug UI). Default: false */
  dev?: boolean
  /** Which trackers to enable. Default: all. */
  trackers?: EventType[]
  /** Sampling rate 0-1. 1 = capture all events. Default: 1 */
  sampleRate?: number
  /** Max events in buffer before flush. Default: 20 */
  batchSize?: number
  /** Flush interval in ms. Default: 5000 */
  flushInterval?: number
  /** Session rotation interval in ms. Default: 86400000 (24h) */
  sessionRotationMs?: number
  /** Respect Do Not Track. Default: true */
  respectDNT?: boolean
}

// ─── Tracker ──────────────────────────────────────────────────

export interface Tracker {
  readonly type: EventType
  start(emitter: EventEmitFn): void
  stop(): void
}

export type EventEmitFn = (type: EventType, data: Record<string, number | string | boolean>) => void
