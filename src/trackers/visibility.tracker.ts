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

    const elements = document.querySelectorAll('[data-intent]')

    this.observer = new IntersectionObserver(
      (entries) => this.handleEntries(entries),
      { threshold: 0.5 }
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
        state.enterTime = now
        this.emit('visibility', {
          section,
          visibleMs: state.totalVisibleMs,
          intersectionRatio: Math.round(entry.intersectionRatio * 100) / 100,
          entered: true,
        })
      } else if (state.enterTime > 0) {
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
