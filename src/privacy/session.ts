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
    const bytes = new Uint8Array(8)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes)
    } else {
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
