import type { Tracker, EventEmitFn } from '../core/types'

export class PointerTracker implements Tracker {
  readonly type = 'pointer' as const

  private emit: EventEmitFn | null = null
  private lastX = 0
  private lastY = 0
  private lastTime = 0
  private throttleTimer: ReturnType<typeof setTimeout> | null = null
  private bound = false

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
    if (this.throttleTimer) return
    this.throttleTimer = setTimeout(() => { this.throttleTimer = null }, 150)

    const now = performance.now()
    const x = e.clientX
    const y = e.clientY
    const dt = this.lastTime > 0 ? now - this.lastTime : 16.67
    const dx = x - this.lastX
    const dy = y - this.lastY
    const distance = Math.sqrt(dx * dx + dy * dy)
    const velocity = dt > 0 ? distance / dt : 0

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
