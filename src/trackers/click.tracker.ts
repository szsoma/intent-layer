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

    const isInteractive = ClickTracker.INTERACTIVE_TAGS.has(target?.tagName) ||
      target?.closest?.('[role="button"], [role="link"], [tabindex]') !== null
    const dead = !isInteractive

    const now = performance.now()
    const clickRecord: ClickRecord = { target: targetElement, x: e.clientX, y: e.clientY, time: now }
    this.recentClicks.push(clickRecord)
    this.recentClicks = this.recentClicks.filter((c) => now - c.time < 500)

    const rage = this.recentClicks.filter(
      (c) => c.target === targetElement &&
        Math.abs(c.x - e.clientX) < 20 &&
        Math.abs(c.y - e.clientY) < 20
    ).length >= 3

    ;(this.emit as Function)({
      type: 'click',
      data: {
        x: e.clientX,
        y: e.clientY,
        targetElement,
        holdMs: Math.round(holdMs),
        approachDecel: false,
        rage,
        dead,
      },
    })

    this.mouseDownTime = 0
    this.mouseDownTarget = null
  }
}
