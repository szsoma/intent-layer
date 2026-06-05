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

    this.emit('navigation', {
      from: '',
      to: location.pathname,
      trigger: 'initial',
    })

    const self = this

    this.originalPushState = history.pushState.bind(history)
    history.pushState = function (...args: Parameters<typeof history.pushState>) {
      self.originalPushState!(...args)
      self.onNavigate('pushState')
    }

    this.originalReplaceState = history.replaceState.bind(history)
    history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
      self.originalReplaceState!(...args)
      self.onNavigate('replaceState')
    }

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
