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
