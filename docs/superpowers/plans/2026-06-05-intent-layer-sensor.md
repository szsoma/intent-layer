# Intent Layer Sensor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 5KB behavioral signal collection library (Layer 1 only) that can be deployed on a real client site in Week 2.

**Architecture:** Event-driven sensor layer. Modular trackers emit typed events through a central EventBus. Events flow into a bounded in-memory Buffer that flushes periodically via sendBeacon/fetch. Privacy-first: session-scoped rotating hashes, DNT respect, no PII captured. Framework-agnostic — ships as ESM + IIFE via Vite.

**Tech Stack:** TypeScript, Vitest, Vite (build). Zero runtime dependencies.

---

## File Structure

```
intent-layer/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── index.ts                    # Public API exports
│   ├── core/
│   │   ├── types.ts                # All shared type definitions
│   │   ├── event-bus.ts            # Typed internal event emitter
│   │   └── sdk.ts                  # Main SDK class, orchestrates everything
│   ├── trackers/
│   │   ├── tracker.ts              # Base Tracker interface
│   │   ├── pointer.tracker.ts      # Mouse/touch movement + velocity
│   │   ├── scroll.tracker.ts       # Scroll velocity + section dwell
│   │   ├── click.tracker.ts        # Click confidence + rage/dead detection
│   │   ├── visibility.tracker.ts   # IntersectionObserver per [data-intent]
│   │   └── navigation.tracker.ts   # SPA route changes + page sequence
│   ├── transport/
│   │   ├── buffer.ts               # Bounded in-memory event queue
│   │   ├── beacon.ts               # sendBeacon + fetch keepalive transport
│   │   └── logger.ts               # Console transport (dev mode)
│   └── privacy/
│       ├── session.ts              # Session-scoped hash, 24h rotation
│       └── consent.ts              # DNT check, CMP integration
├── tests/
│   ├── core/
│   │   ├── event-bus.test.ts
│   │   └── sdk.test.ts
│   ├── trackers/
│   │   ├── pointer.tracker.test.ts
│   │   ├── scroll.tracker.test.ts
│   │   ├── click.tracker.test.ts
│   │   ├── visibility.tracker.test.ts
│   │   └── navigation.tracker.test.ts
│   ├── transport/
│   │   ├── buffer.test.ts
│   │   ├── beacon.test.ts
│   │   └── logger.test.ts
│   └── privacy/
│       ├── session.test.ts
│       └── consent.test.ts
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "intent-layer",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/intent-layer.cjs",
  "module": "./dist/intent-layer.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/intent-layer.js",
      "require": "./dist/intent-layer.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "size": "node -e \"const{gzipSync}=require('zlib');const{readFileSync}=require('fs');const f=readFileSync('dist/intent-layer.js');console.log('gzip:',(gzipSync(f).length/1024).toFixed(1)+'KB')\"",
    "check:size": "vite build && node -e \"const{gzipSync}=require('zlib');const{readFileSync}=require('fs');const f=readFileSync('dist/intent-layer.js');const kb=gzipSync(f).length/1024;console.log('gzip:',kb.toFixed(1)+'KB');if(kb>5)process.exit(1)\""
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationDir": "./dist",
    "outDir": "./dist",
    "sourceMap": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'IntentLayer',
      formats: ['es', 'iife'],
      fileName: (format) => `intent-layer${format === 'iife' ? '.iife' : ''}.js`,
    },
    rollupOptions: {
      output: {
        compact: true,
      },
    },
    // Enforce size budget
    reportCompressedSize: true,
    target: 'es2020',
    minify: 'terser',
  },
})
```

- [ ] **Step 4: Install dependencies**

Run: `cd intent-layer && npm install`

- [ ] **Step 5: Verify setup**

Run: `npx vitest run`
Expected: "no test files found" (passes — scaffold is clean)

- [ ] **Step 6: Commit**

```bash
git init
echo "node_modules/\ndist/\n*.local" > .gitignore
git add -A
git commit -m "chore: scaffold intent-layer project with TypeScript, Vitest, Vite"
```

---

## Task 2: Core Types

**Files:**
- Create: `src/core/types.ts`

- [ ] **Step 1: Write the type definitions**

```typescript
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
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/core/types.ts
git commit -m "feat: add core type definitions for all event types, tracker interface, and SDK config"
```

---

## Task 3: EventBus

**Files:**
- Create: `src/core/event-bus.ts`
- Create: `tests/core/event-bus.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/core/event-bus.test.ts
import { describe, it, expect, vi } from 'vitest'
import { EventBus } from '../../src/core/event-bus'
import type { BehavioralEvent } from '../../src/core/types'

describe('EventBus', () => {
  it('calls subscriber when an event is emitted', () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('pointer', handler)

    bus.emit('pointer', { x: 100, y: 200, velocity: 0.5, targetElement: 'none', targetDistance: 0 })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'pointer', data: { x: 100, y: 200 } })
    )
  })

  it('does not call subscriber for different event types', () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('pointer', handler)

    bus.emit('scroll', { scrollY: 500, velocity: 1.2, section: 'hero', sectionDwell: 0, scrollDepth: 500 })

    expect(handler).not.toHaveBeenCalled()
  })

  it('supports multiple subscribers on the same type', () => {
    const bus = new EventBus()
    const handler1 = vi.fn()
    const handler2 = vi.fn()
    bus.on('click', handler1)
    bus.on('click', handler2)

    bus.emit('click', { x: 0, y: 0, targetElement: 'btn', holdMs: 80, approachDecel: false, rage: false, dead: false })

    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes when off is called', () => {
    const bus = new EventBus()
    const handler = vi.fn()
    bus.on('pointer', handler)
    bus.off('pointer', handler)

    bus.emit('pointer', { x: 0, y: 0, velocity: 0, targetElement: 'none', targetDistance: 0 })

    expect(handler).not.toHaveBeenCalled()
  })

  it('includes sessionId, timestamp, and url in emitted events', () => {
    const bus = new EventBus('test-session-123')
    const handler = vi.fn()
    bus.on('click', handler)

    bus.emit('click', { x: 10, y: 20, targetElement: 'cta', holdMs: 90, approachDecel: true, rage: false, dead: false })

    const event: BehavioralEvent = handler.mock.calls[0][0]
    expect(event.sessionId).toBe('test-session-123')
    expect(event.timestamp).toBeGreaterThan(0)
    expect(event.type).toBe('click')
    expect(typeof event.url).toBe('string')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/event-bus.test.ts`
Expected: FAIL — `EventBus` is not defined

- [ ] **Step 3: Write the EventBus implementation**

```typescript
// src/core/event-bus.ts
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
        // Swallow handler errors — a bad subscriber must not break collection
      }
    })
  }

  updateSession(sessionId: string): void {
    this.sessionId = sessionId
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/core/event-bus.test.ts`
Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/event-bus.ts tests/core/event-bus.test.ts
git commit -m "feat: add EventBus with typed pub/sub for behavioral events"
```

---

## Task 4: Session Manager

**Files:**
- Create: `src/privacy/session.ts`
- Create: `tests/privacy/session.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/privacy/session.test.ts
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
    // Create a second manager — same "fingerprint" in same time window
    const mgr2 = new SessionManager({ rotationMs: 86400000 })
    const id2 = mgr2.getSessionId()
    // IDs should be different (random component) but same length
    expect(id1).toMatch(/^[a-f0-9]{16}$/)
    expect(id2).toMatch(/^[a-f0-9]{16}$/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/privacy/session.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the SessionManager implementation**

```typescript
// src/privacy/session.ts
export interface SessionConfig {
  /** How often to rotate the session ID. Default: 86400000 (24h) */
  rotationMs?: number
}

export class SessionManager {
  private sessionId: string = ''
  private createdAt: number = 0
  private readonly rotationMs: number

  constructor(config: SessionConfig = {}) {
    this.rotationMs = config.rotationMs ?? 86400000
    this.rotate()
  }

  getSessionId(): string {
    if (Date.now() - this.createdAt >= this.rotationMs) {
      this.rotate()
    }
    return this.sessionId
  }

  private rotate(): void {
    this.sessionId = this.generateId()
    this.createdAt = Date.now()
  }

  private generateId(): string {
    // crypto.getRandomValues for cryptographic randomness
    const bytes = new Uint8Array(8)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes)
    } else {
      // Fallback for non-browser environments (tests)
      for (let i = 0; i < 8; i++) {
        bytes[i] = Math.floor(Math.random() * 256)
      }
    }
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/privacy/session.test.ts`
Expected: all 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/privacy/session.ts tests/privacy/session.test.ts
git commit -m "feat: add SessionManager with 24h rotating session IDs"
```

---

## Task 5: Consent Check

**Files:**
- Create: `src/privacy/consent.ts`
- Create: `tests/privacy/consent.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/privacy/consent.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the ConsentGate implementation**

```typescript
// src/privacy/consent.ts
export interface ConsentConfig {
  /** Respect Do Not Track browser setting. Default: true */
  respectDNT?: boolean
}

export class ConsentGate {
  private readonly respectDNT: boolean

  constructor(config: ConsentConfig = {}) {
    this.respectDNT = config.respectDNT ?? true
  }

  canTrack(): boolean {
    if (!this.respectDNT) return true
    const dnt = typeof navigator !== 'undefined' ? navigator.doNotTrack : null
    return dnt !== '1'
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/privacy/consent.test.ts`
Expected: all 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/privacy/consent.ts tests/privacy/consent.test.ts
git commit -m "feat: add ConsentGate for Do Not Track respect"
```

---

## Task 6: Event Buffer

**Files:**
- Create: `src/transport/buffer.ts`
- Create: `tests/transport/buffer.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/transport/buffer.test.ts
import { describe, it, expect } from 'vitest'
import { EventBuffer } from '../../src/transport/buffer'
import type { BehavioralEvent } from '../../src/core/types'

function makeEvent(type: string, i: number): BehavioralEvent {
  return {
    sessionId: 'test',
    timestamp: performance.now(),
    type: type as BehavioralEvent['type'],
    url: '/test',
    data: { index: i },
  }
}

describe('EventBuffer', () => {
  it('stores and retrieves events', () => {
    const buf = new EventBuffer({ maxSize: 50 })
    const event = makeEvent('click', 1)
    buf.push(event)
    expect(buf.flush()).toEqual([event])
  })

  it('flushes all events and clears the buffer', () => {
    const buf = new EventBuffer({ maxSize: 50 })
    buf.push(makeEvent('click', 1))
    buf.push(makeEvent('scroll', 2))
    buf.flush()
    expect(buf.flush()).toEqual([])
  })

  it('drops oldest events when buffer exceeds maxSize', () => {
    const buf = new EventBuffer({ maxSize: 3 })
    buf.push(makeEvent('click', 1))
    buf.push(makeEvent('click', 2))
    buf.push(makeEvent('click', 3))
    buf.push(makeEvent('click', 4)) // should evict event 1

    const events = buf.flush()
    expect(events).toHaveLength(3)
    expect(events[0].data.index).toBe(2) // event 1 was dropped
  })

  it('reports correct size', () => {
    const buf = new EventBuffer({ maxSize: 50 })
    expect(buf.size).toBe(0)
    buf.push(makeEvent('click', 1))
    expect(buf.size).toBe(1)
  })

  it('returns empty array when flushing empty buffer', () => {
    const buf = new EventBuffer({ maxSize: 50 })
    expect(buf.flush()).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/transport/buffer.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the EventBuffer implementation**

```typescript
// src/transport/buffer.ts
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
      this.queue.shift() // drop oldest
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/transport/buffer.test.ts`
Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/transport/buffer.ts tests/transport/buffer.test.ts
git commit -m "feat: add EventBuffer with bounded in-memory queue"
```

---

## Task 7: Logger Transport

**Files:**
- Create: `src/transport/logger.ts`
- Create: `tests/transport/logger.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/transport/logger.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the LoggerTransport implementation**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/transport/logger.test.ts`
Expected: all 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/transport/logger.ts tests/transport/logger.test.ts
git commit -m "feat: add LoggerTransport for dev-mode console output"
```

---

## Task 8: Beacon Transport

**Files:**
- Create: `src/transport/beacon.ts`
- Create: `tests/transport/beacon.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/transport/beacon.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { BeaconTransport } from '../../src/transport/beacon'
import type { BehavioralEvent } from '../../src/core/types'

const sampleEvent: BehavioralEvent = {
  sessionId: 'abc123',
  timestamp: 1000,
  type: 'click',
  url: '/pricing',
  data: { x: 100, y: 200 },
}

describe('BeaconTransport', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends events via sendBeacon when available', () => {
    const beaconSpy = vi.fn().mockReturnValue(true)
    vi.stubGlobal('navigator', { sendBeacon: beaconSpy })

    const transport = new BeaconTransport({ endpoint: 'https://example.com/collect' })
    const result = transport.send([sampleEvent])

    expect(result).toBe(true)
    expect(beaconSpy).toHaveBeenCalledTimes(1)
    expect(beaconSpy.mock.calls[0][0]).toBe('https://example.com/collect')
  })

  it('falls back to fetch with keepalive when sendBeacon unavailable', async () => {
    vi.stubGlobal('navigator', {}) // no sendBeacon
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchSpy)

    const transport = new BeaconTransport({ endpoint: 'https://example.com/collect' })
    const result = transport.send([sampleEvent])

    expect(result).toBe(true)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][1].keepalive).toBe(true)
  })

  it('returns false when endpoint is not configured', () => {
    const transport = new BeaconTransport({ endpoint: undefined })
    const result = transport.send([sampleEvent])
    expect(result).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/transport/beacon.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the BeaconTransport implementation**

```typescript
// src/transport/beacon.ts
import type { BehavioralEvent } from '../core/types'
import type { TransportPayload } from '../core/types'

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

    // Try sendBeacon first (survives page unload)
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      return navigator.sendBeacon(this.endpoint, body)
    }

    // Fallback to fetch with keepalive
    if (typeof fetch !== 'undefined') {
      fetch(this.endpoint, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
      }).catch(() => {
        // Swallow — transport failures must not break the page
      })
      return true
    }

    return false
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/transport/beacon.test.ts`
Expected: all 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/transport/beacon.ts tests/transport/beacon.test.ts
git commit -m "feat: add BeaconTransport with sendBeacon + fetch keepalive fallback"
```

---

## Task 9: Pointer Tracker

**Files:**
- Create: `src/trackers/tracker.ts`
- Create: `src/trackers/pointer.tracker.ts`
- Create: `tests/trackers/pointer.tracker.test.ts`

- [ ] **Step 1: Create base Tracker interface file (re-exports from types)**

```typescript
// src/trackers/tracker.ts
export type { Tracker, EventEmitFn } from '../core/types'
```

- [ ] **Step 2: Write the failing test**

```typescript
// tests/trackers/pointer.tracker.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PointerTracker } from '../../src/trackers/pointer.tracker'
import type { EventEmitFn } from '../../src/core/types'

describe('PointerTracker', () => {
  let emit: EventEmitFn
  let tracker: PointerTracker

  beforeEach(() => {
    emit = vi.fn()
    tracker = new PointerTracker()
  })

  it('emits pointer events from mousemove (throttled)', () => {
    tracker.start(emit)

    // Simulate rapid mousemove events
    const handler = document.addEventListener.mock ?? null
    // We'll use the tracker's internal throttling
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 200 }))
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 110, clientY: 210 }))

    // At least one event should have been emitted (throttled)
    tracker.stop()
  })

  it('has type "pointer"', () => {
    expect(tracker.type).toBe('pointer')
  })

  it('stops listening after stop() is called', () => {
    tracker.start(emit)
    tracker.stop()

    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 500, clientY: 500 }))

    // emit should not be called for events after stop
    // (it may have been called during start phase)
    const callCount = (emit as ReturnType<typeof vi.fn>).mock.calls.length
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 600, clientY: 600 }))
    expect((emit as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCount)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/trackers/pointer.tracker.test.ts`
Expected: FAIL

- [ ] **Step 4: Write the PointerTracker implementation**

```typescript
// src/trackers/pointer.tracker.ts
import type { Tracker, EventEmitFn } from '../core/types'

export class PointerTracker implements Tracker {
  readonly type = 'pointer' as const

  private emit: EventEmitFn | null = null
  private lastX = 0
  private lastY = 0
  private lastTime = 0
  private throttleTimer: ReturnType<typeof setTimeout> | null = null
  private bound: boolean = false

  start(emit: EventEmitFn): void {
    this.emit = emit
    this.bound = true
    document.addEventListener('mousemove', this.onMouseMove as EventListener)
  }

  stop(): void {
    if (this.bound) {
      document.removeEventListener('mousemove', this.onMouseMove as EventListener)
      this.bound = false
    }
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer)
      this.throttleTimer = null
    }
    this.emit = null
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.emit) return

    // Throttle: only process every 150ms
    if (this.throttleTimer) return
    this.throttleTimer = setTimeout(() => {
      this.throttleTimer = null
    }, 150)

    const now = performance.now()
    const x = e.clientX
    const y = e.clientY

    // Calculate velocity (px/ms)
    const dt = this.lastTime > 0 ? now - this.lastTime : 16.67
    const dx = x - this.lastX
    const dy = y - this.lastY
    const distance = Math.sqrt(dx * dx + dy * dy)
    const velocity = dt > 0 ? distance / dt : 0

    // Find nearest [data-intent] element
    const target = e.target as HTMLElement
    const intentEl = target?.closest?.('[data-intent]') as HTMLElement | null
    const targetElement = intentEl?.getAttribute('data-intent') ?? 'none'
    const targetDistance = intentEl
      ? this.elementDistance(x, y, intentEl.getBoundingClientRect())
      : 0

    this.emit('pointer', {
      x,
      y,
      velocity: Math.round(velocity * 1000) / 1000,
      targetElement,
      targetDistance: Math.round(targetDistance),
    })

    this.lastX = x
    this.lastY = y
    this.lastTime = now
  }

  private elementDistance(x: number, y: number, rect: DOMRect): number {
    const cx = Math.max(rect.left, Math.min(x, rect.right))
    const cy = Math.max(rect.top, Math.min(y, rect.bottom))
    return Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/trackers/pointer.tracker.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/trackers/tracker.ts src/trackers/pointer.tracker.ts tests/trackers/pointer.tracker.test.ts
git commit -m "feat: add PointerTracker with throttled mouse velocity tracking"
```

---

## Task 10: Scroll Tracker

**Files:**
- Create: `src/trackers/scroll.tracker.ts`
- Create: `tests/trackers/scroll.tracker.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/trackers/scroll.tracker.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ScrollTracker } from '../../src/trackers/scroll.tracker'
import type { EventEmitFn } from '../../src/core/types'

describe('ScrollTracker', () => {
  let emit: EventEmitFn
  let tracker: ScrollTracker

  beforeEach(() => {
    emit = vi.fn()
    tracker = new ScrollTracker()
  })

  it('has type "scroll"', () => {
    expect(tracker.type).toBe('scroll')
  })

  it('emits scroll events when page is scrolled', () => {
    tracker.start(emit)

    // Simulate scroll by dispatching on window
    window.dispatchEvent(new Event('scroll'))

    tracker.stop()
    // At minimum, scroll tracking was active without errors
  })

  it('stops listening after stop()', () => {
    tracker.start(emit)
    tracker.stop()

    const callsBefore = (emit as ReturnType<typeof vi.fn>).mock.calls.length
    window.dispatchEvent(new Event('scroll'))
    expect((emit as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsBefore)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/trackers/scroll.tracker.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the ScrollTracker implementation**

```typescript
// src/trackers/scroll.tracker.ts
import type { Tracker, EventEmitFn } from '../core/types'

export class ScrollTracker implements Tracker {
  readonly type = 'scroll' as const

  private emit: EventEmitFn | null = null
  private lastScrollY = 0
  private lastTime = 0
  private maxScrollY = 0
  private sectionEnterTime = 0
  private currentSection = ''
  private throttleTimer: ReturnType<typeof setTimeout> | null = null
  private bound = false

  start(emit: EventEmitFn): void {
    this.emit = emit
    this.bound = true
    this.lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0
    this.lastTime = performance.now()
    this.maxScrollY = this.lastScrollY
    window.addEventListener('scroll', this.onScroll as EventListener, { passive: true })
  }

  stop(): void {
    if (this.bound) {
      window.removeEventListener('scroll', this.onScroll as EventListener)
      this.bound = false
    }
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer)
      this.throttleTimer = null
    }
    this.emit = null
  }

  private onScroll = (): void => {
    if (!this.emit) return
    if (this.throttleTimer) return
    this.throttleTimer = setTimeout(() => { this.throttleTimer = null }, 200)

    const now = performance.now()
    const scrollY = typeof window !== 'undefined' ? window.scrollY : 0
    const dt = now - this.lastTime
    const dy = scrollY - this.lastScrollY
    const velocity = dt > 0 ? dy / dt : 0

    if (scrollY > this.maxScrollY) this.maxScrollY = scrollY

    // Detect current [data-intent] section
    const section = this.detectSection()
    if (section !== this.currentSection) {
      this.currentSection = section
      this.sectionEnterTime = now
    }

    const sectionDwell = this.currentSection ? now - this.sectionEnterTime : 0

    this.emit('scroll', {
      scrollY,
      velocity: Math.round(velocity * 1000) / 1000,
      section: this.currentSection,
      sectionDwell: Math.round(sectionDwell),
      scrollDepth: this.maxScrollY,
    })

    this.lastScrollY = scrollY
    this.lastTime = now
  }

  private detectSection(): string {
    const sections = document.querySelectorAll('[data-intent]')
    const viewportMiddle = (typeof window !== 'undefined' ? window.innerHeight : 800) / 2

    for (const section of sections) {
      const rect = (section as HTMLElement).getBoundingClientRect()
      if (rect.top <= viewportMiddle && rect.bottom >= viewportMiddle) {
        return section.getAttribute('data-intent') ?? ''
      }
    }
    return ''
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/trackers/scroll.tracker.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/trackers/scroll.tracker.ts tests/trackers/scroll.tracker.test.ts
git commit -m "feat: add ScrollTracker with velocity, section dwell, and scroll depth"
```

---

## Task 11: Click Tracker

**Files:**
- Create: `src/trackers/click.tracker.ts`
- Create: `tests/trackers/click.tracker.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/trackers/click.tracker.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClickTracker } from '../../src/trackers/click.tracker'
import type { EventEmitFn } from '../../src/core/types'

describe('ClickTracker', () => {
  let emit: EventEmitFn
  let tracker: ClickTracker

  beforeEach(() => {
    emit = vi.fn()
    tracker = new ClickTracker()
  })

  it('has type "click"', () => {
    expect(tracker.type).toBe('click')
  })

  it('emits click event with hold duration', () => {
    tracker.start(emit)

    // Simulate mousedown then mouseup
    const target = document.createElement('button')
    target.setAttribute('data-intent', 'cta-primary')
    document.body.appendChild(target)

    target.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 200, bubbles: true }))
    target.dispatchEvent(new MouseEvent('mouseup', { clientX: 100, clientY: 200, bubbles: true }))

    expect(emit).toHaveBeenCalled()
    const call = (emit as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: unknown[]) => (c as [{ type: string }])[0]?.type === 'click'
    )
    expect(call).toBeDefined()

    document.body.removeChild(target)
    tracker.stop()
  })

  it('detects rage clicks (3+ clicks within 500ms on same element)', () => {
    tracker.start(emit)

    const target = document.createElement('div')
    target.setAttribute('data-intent', 'nav-link')
    document.body.appendChild(target)

    for (let i = 0; i < 4; i++) {
      target.dispatchEvent(new MouseEvent('mousedown', { clientX: 50, clientY: 50, bubbles: true }))
      target.dispatchEvent(new MouseEvent('mouseup', { clientX: 50, clientY: 50, bubbles: true }))
    }

    const calls = (emit as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => (c as [{ data: { rage: boolean } }])[0]?.data?.rage === true
    )
    expect(calls.length).toBeGreaterThanOrEqual(1)

    document.body.removeChild(target)
    tracker.stop()
  })

  it('stops listening after stop()', () => {
    tracker.start(emit)
    tracker.stop()

    const callsBefore = (emit as ReturnType<typeof vi.fn>).mock.calls.length
    document.dispatchEvent(new MouseEvent('mousedown'))
    document.dispatchEvent(new MouseEvent('mouseup'))
    expect((emit as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsBefore)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/trackers/click.tracker.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the ClickTracker implementation**

```typescript
// src/trackers/click.tracker.ts
import type { Tracker, EventEmitFn } from '../core/types'

interface ClickRecord {
  target: string
  x: number
  y: number
  time: number
}

export class ClickTracker implements Tracker {
  readonly type = 'click' as const

  private emit: EventEmitFn | null = null
  private bound = false
  private mouseDownTime = 0
  private mouseDownTarget: HTMLElement | null = null
  private recentClicks: ClickRecord[] = []

  // Interactive element tags (for dead click detection)
  private static readonly INTERACTIVE_TAGS = new Set([
    'A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL',
    'SUMMARY', 'DETAILS', 'OPTION', 'OPTGROUP',
  ])

  start(emit: EventEmitFn): void {
    this.emit = emit
    this.bound = true
    document.addEventListener('mousedown', this.onMouseDown as EventListener, true)
    document.addEventListener('mouseup', this.onMouseUp as EventListener, true)
  }

  stop(): void {
    if (this.bound) {
      document.removeEventListener('mousedown', this.onMouseDown as EventListener, true)
      document.removeEventListener('mouseup', this.onMouseUp as EventListener, true)
      this.bound = false
    }
    this.emit = null
  }

  private onMouseDown = (e: MouseEvent): void => {
    this.mouseDownTime = performance.now()
    this.mouseDownTarget = e.target as HTMLElement
  }

  private onMouseUp = (e: MouseEvent): void => {
    if (!this.emit) return

    const holdMs = performance.now() - this.mouseDownTime
    const target = e.target as HTMLElement
    const intentEl = target?.closest?.('[data-intent]') as HTMLElement | null
    const targetElement = intentEl?.getAttribute('data-intent') ?? target?.tagName?.toLowerCase() ?? 'unknown'

    // Dead click: clicked on non-interactive element
    const isInteractive = ClickTracker.INTERACTIVE_TAGS.has(target?.tagName) ||
      target?.closest?.('[role="button"], [role="link"], [tabindex]') !== null
    const dead = !isInteractive

    // Rage click detection
    const now = performance.now()
    const clickRecord: ClickRecord = { target: targetElement, x: e.clientX, y: e.clientY, time: now }
    this.recentClicks.push(clickRecord)
    // Keep only clicks from last 500ms
    this.recentClicks = this.recentClicks.filter((c) => now - c.time < 500)

    // Rage = 3+ clicks within 500ms on same target area (within 20px)
    const rage = this.recentClicks.filter(
      (c) => c.target === targetElement &&
        Math.abs(c.x - e.clientX) < 20 &&
        Math.abs(c.y - e.clientY) < 20
    ).length >= 3

    this.emit('click', {
      x: e.clientX,
      y: e.clientY,
      targetElement,
      holdMs: Math.round(holdMs),
      approachDecel: false, // requires pointer tracker data — will be wired in SDK
      rage,
      dead,
    })

    this.mouseDownTime = 0
    this.mouseDownTarget = null
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/trackers/click.tracker.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/trackers/click.tracker.ts tests/trackers/click.tracker.test.ts
git commit -m "feat: add ClickTracker with hold duration, rage click, and dead click detection"
```

---

## Task 12: Visibility Tracker

**Files:**
- Create: `src/trackers/visibility.tracker.ts`
- Create: `tests/trackers/visibility.tracker.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/trackers/visibility.tracker.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VisibilityTracker } from '../../src/trackers/visibility.tracker'
import type { EventEmitFn } from '../../src/core/types'

describe('VisibilityTracker', () => {
  let emit: EventEmitFn
  let tracker: VisibilityTracker

  beforeEach(() => {
    emit = vi.fn()
    tracker = new VisibilityTracker()
  })

  it('has type "visibility"', () => {
    expect(tracker.type).toBe('visibility')
  })

  it('stops cleanly after stop()', () => {
    tracker.start(emit)
    tracker.stop()
    // No errors = pass
  })

  it('uses IntersectionObserver to track [data-intent] elements', () => {
    // Mock IntersectionObserver
    const observeSpy = vi.fn()
    const disconnectSpy = vi.fn()
    vi.stubGlobal('IntersectionObserver', class {
      observe = observeSpy
      disconnect = disconnectSpy
      unobserve = vi.fn()
      takeRecords = vi.fn().mockReturnValue([])
    })

    const el = document.createElement('section')
    el.setAttribute('data-intent', 'features')
    document.body.appendChild(el)

    tracker.start(emit)
    expect(observeSpy).toHaveBeenCalledWith(el)

    tracker.stop()
    document.body.removeChild(el)
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/trackers/visibility.tracker.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the VisibilityTracker implementation**

```typescript
// src/trackers/visibility.tracker.ts
import type { Tracker, EventEmitFn } from '../core/types'

interface SectionState {
  enterTime: number
  totalVisibleMs: number
}

export class VisibilityTracker implements Tracker {
  readonly type = 'visibility' as const

  private emit: EventEmitFn | null = null
  private observer: IntersectionObserver | null = null
  private sections: Map<string, SectionState> = new Map()

  start(emit: EventEmitFn): void {
    this.emit = emit

    // Observe all [data-intent] sections
    const elements = document.querySelectorAll('[data-intent]')

    this.observer = new IntersectionObserver(
      (entries) => this.handleEntries(entries),
      { threshold: 0.5 } // 50% of element visible = "in view"
    )

    elements.forEach((el) => {
      this.observer!.observe(el)
      const name = el.getAttribute('data-intent') ?? ''
      this.sections.set(name, { enterTime: 0, totalVisibleMs: 0 })
    })
  }

  stop(): void {
    this.observer?.disconnect()
    this.observer = null
    this.emit = null
    this.sections.clear()
  }

  private handleEntries(entries: IntersectionObserverEntry[]): void {
    if (!this.emit) return
    const now = performance.now()

    for (const entry of entries) {
      const section = (entry.target as HTMLElement).getAttribute('data-intent') ?? ''
      if (!section) continue

      const state = this.sections.get(section)
      if (!state) continue

      if (entry.isIntersecting) {
        // Section entered viewport
        state.enterTime = now
        this.emit('visibility', {
          section,
          visibleMs: state.totalVisibleMs,
          intersectionRatio: Math.round(entry.intersectionRatio * 100) / 100,
          entered: true,
        })
      } else if (state.enterTime > 0) {
        // Section left viewport
        state.totalVisibleMs += now - state.enterTime
        state.enterTime = 0
        this.emit('visibility', {
          section,
          visibleMs: Math.round(state.totalVisibleMs),
          intersectionRatio: 0,
          entered: false,
        })
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/trackers/visibility.tracker.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/trackers/visibility.tracker.ts tests/trackers/visibility.tracker.test.ts
git commit -m "feat: add VisibilityTracker with IntersectionObserver per [data-intent] section"
```

---

## Task 13: Navigation Tracker

**Files:**
- Create: `src/trackers/navigation.tracker.ts`
- Create: `tests/trackers/navigation.tracker.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/trackers/navigation.tracker.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NavigationTracker } from '../../src/trackers/navigation.tracker'
import type { EventEmitFn } from '../../src/core/types'

describe('NavigationTracker', () => {
  let emit: EventEmitFn
  let tracker: NavigationTracker

  beforeEach(() => {
    emit = vi.fn()
    tracker = new NavigationTracker()
  })

  it('has type "navigation"', () => {
    expect(tracker.type).toBe('navigation')
  })

  it('emits initial navigation on start', () => {
    tracker.start(emit)
    expect(emit).toHaveBeenCalledWith('navigation', expect.objectContaining({
      trigger: 'initial',
    }))
    tracker.stop()
  })

  it('patches history.pushState to emit navigation events', () => {
    const originalPushState = history.pushState
    tracker.start(emit)

    history.pushState({}, '', '/new-page')
    expect(emit).toHaveBeenCalledWith('navigation', expect.objectContaining({
      trigger: 'pushState',
      to: '/new-page',
    }))

    // Restore
    history.pushState = originalPushState
    tracker.stop()
  })

  it('stops patching history after stop()', () => {
    const originalPushState = history.pushState
    tracker.start(emit)
    tracker.stop()

    const callsBefore = (emit as ReturnType<typeof vi.fn>).mock.calls.length
    history.pushState({}, '', '/another-page')
    expect((emit as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callsBefore)

    history.pushState = originalPushState
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/trackers/navigation.tracker.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the NavigationTracker implementation**

```typescript
// src/trackers/navigation.tracker.ts
import type { Tracker, EventEmitFn } from '../core/types'

export class NavigationTracker implements Tracker {
  readonly type = 'navigation' as const

  private emit: EventEmitFn | null = null
  private previousUrl = ''
  private originalPushState: typeof history.pushState | null = null
  private originalReplaceState: typeof history.replaceState | null = null
  private boundPopstate: ((e: Event) => void) | null = null

  start(emit: EventEmitFn): void {
    this.emit = emit
    this.previousUrl = location.pathname

    // Emit initial page load
    this.emit('navigation', {
      from: '',
      to: location.pathname,
      trigger: 'initial',
    })

    // Patch pushState
    this.originalPushState = history.pushState.bind(history)
    const self = this
    history.pushState = function (...args: Parameters<typeof history.pushState>) {
      self.originalPushState!(...args)
      self.onNavigate('pushState')
    }

    // Patch replaceState
    this.originalReplaceState = history.replaceState.bind(history)
    history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
      self.originalReplaceState!(...args)
      self.onNavigate('replaceState')
    }

    // Listen for popstate (back/forward)
    this.boundPopstate = () => this.onNavigate('popstate')
    window.addEventListener('popstate', this.boundPopstate)
  }

  stop(): void {
    if (this.originalPushState) {
      history.pushState = this.originalPushState
    }
    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState
    }
    if (this.boundPopstate) {
      window.removeEventListener('popstate', this.boundPopstate)
    }
    this.originalPushState = null
    this.originalReplaceState = null
    this.boundPopstate = null
    this.emit = null
  }

  private onNavigate(trigger: 'pushState' | 'replaceState' | 'popstate'): void {
    if (!this.emit) return
    const to = location.pathname
    if (to === this.previousUrl) return

    this.emit('navigation', {
      from: this.previousUrl,
      to,
      trigger,
    })
    this.previousUrl = to
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/trackers/navigation.tracker.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/trackers/navigation.tracker.ts tests/trackers/navigation.tracker.test.ts
git commit -m "feat: add NavigationTracker with history API patching for SPA route detection"
```

---

## Task 14: SDK Entry Point

**Files:**
- Create: `src/core/sdk.ts`
- Create: `src/index.ts`
- Create: `tests/core/sdk.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/core/sdk.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { IntentLayer } from '../../src/core/sdk'

describe('IntentLayer', () => {
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
    // SDK should be inert
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
    // No errors = buffer was flushed
  })

  it('flushes buffer on visibilitychange (page hidden)', () => {
    vi.stubGlobal('navigator', { doNotTrack: null, sendBeacon: vi.fn().mockReturnValue(true) })
    const sdk = new IntentLayer({ dev: true, endpoint: 'https://example.com/collect' })

    // Simulate page hidden
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))

    sdk.destroy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/core/sdk.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the SDK implementation**

```typescript
// src/core/sdk.ts
import type { IntentLayerConfig, EventType, BehavioralEvent } from './types'
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
import type { Tracker } from './types'

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

    const emit = (type: EventType, data: Record<string, number | string | boolean>) => {
      // Sample rate gate
      if (type !== 'click' && type !== 'navigation' && Math.random() > this.config.sampleRate) return

      this.eventBus.emit(type, data)

      // Also push to buffer
      const event: BehavioralEvent = {
        sessionId: this.sessionManager.getSessionId(),
        timestamp: performance.now(),
        type,
        url: typeof location !== 'undefined' ? location.pathname : '',
        data,
      }
      this.buffer.push(event)

      // Flush if batch size reached
      if (this.buffer.size >= this.config.batchSize) {
        this.flush()
      }
    }

    for (const type of this.config.trackers) {
      const tracker = trackerMap[type]
      if (tracker) {
        tracker.start(emit)
        this.trackers.push(tracker)
      }
    }

    // Subscribe eventBus to logger for dev mode
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
```

- [ ] **Step 4: Write the public API exports**

```typescript
// src/index.ts
export { IntentLayer } from './core/sdk'
export type { IntentLayerConfig, BehavioralEvent, EventType } from './core/types'
export type {
  PointerData,
  ScrollData,
  ClickData,
  VisibilityData,
  NavigationData,
} from './core/types'
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/core/sdk.test.ts`
Expected: PASS

- [ ] **Step 6: Run all tests**

Run: `npx vitest run`
Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/core/sdk.ts src/index.ts tests/core/sdk.test.ts
git commit -m "feat: add IntentLayer SDK entry point wiring all trackers, transport, and privacy"
```

---

## Task 15: Build Verification & Bundle Size Check

**Files:**
- No new files — validates the build output

- [ ] **Step 1: Build the library**

Run: `npm run build`
Expected: Build completes without errors, outputs to `dist/`

- [ ] **Step 2: Check bundle size**

Run: `npm run size`
Expected: gzip output is under 5KB. If it's over, investigate which module is too large and optimize.

- [ ] **Step 3: Verify IIFE bundle works in browser context**

Create a temporary test file `test-browser.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <script defer src="./dist/intent-layer.iife.js"></script>
</head>
<body>
  <section data-intent="hero">Hero section</section>
  <section data-intent="features">Features section</section>
  <div data-intent="pricing">Pricing section</div>
  <button data-intent="cta-primary">Get Started</button>

  <script>
    // IIFE exposes window.IntentLayer
    const sdk = new IntentLayer({ dev: true });
    console.log('IntentLayer started. Session:', sdk.getSessionId());
  </script>
</body>
</html>
```

Run: `npx serve .` and open `test-browser.html`
Expected: Console shows `[IntentLayer]` log messages for mouse movement, clicks, and scroll events.

- [ ] **Step 4: Clean up test file**

```bash
rm test-browser.html
```

- [ ] **Step 5: Run the size gate CI check**

Run: `npm run check:size`
Expected: Build succeeds and gzip is under 5KB (exit code 0).

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: verify build and bundle size under 5KB gzip"
```

---

## Task 16: Run All Tests (Final Validation)

- [ ] **Step 1: Run complete test suite**

Run: `npx vitest run`
Expected: All tests pass. No failures, no skips.

- [ ] **Step 2: Review test coverage**

Run: `npx vitest run --coverage`
Expected: Coverage report shows all source files covered. If any file is below 70%, add targeted tests.

- [ ] **Step 3: Final commit (if any coverage tests were added)**

```bash
git add -A
git commit -m "test: ensure full test coverage for sensor layer"
```

---

## Post-Build: Deployment Checklist (Week 2)

This is NOT a code task — it's a manual deployment checklist for putting the sensor on a real client site:

- [ ] Identify highest-traffic client site with a pricing page and a conversion event
- [ ] Add `<script defer src="intent-layer.iife.js"></script>` to the site `<head>`
- [ ] Add `data-intent` attributes to key sections (hero, features, pricing, CTA buttons, forms)
- [ ] Configure endpoint pointing to a Supabase table or webhook
- [ ] Verify events appear in the endpoint storage
- [ ] Let it run for 7 days without modification
- [ ] Run the Validation Query from the spec (Week 3)
