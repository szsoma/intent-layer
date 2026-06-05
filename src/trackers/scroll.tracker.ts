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
