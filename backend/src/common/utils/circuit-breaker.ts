/**
 * Circuit breaker simples baseado em contagem de falhas consecutivas.
 * Usado pelos providers de integração externa (WhatsApp, Google Calendar)
 * para parar de martelar uma API fora do ar: depois de N falhas seguidas,
 * abre o circuito por `resetAfterMs` e passa a rejeitar chamadas
 * imediatamente (o chamador cai no fluxo de "enfileirar para retry depois"
 * em vez de esperar um timeout de rede a cada tentativa).
 */
export class CircuitBreaker {
  private consecutiveFailures = 0;
  private openedAt: number | null = null;

  constructor(
    private readonly failureThreshold = 5,
    private readonly resetAfterMs = 60_000,
  ) {}

  isOpen(): boolean {
    if (this.openedAt === null) return false;
    if (Date.now() - this.openedAt >= this.resetAfterMs) {
      // Meia-abertura: permite uma nova tentativa passar.
      this.openedAt = null;
      this.consecutiveFailures = 0;
      return false;
    }
    return true;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.openedAt = null;
  }

  recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.openedAt = Date.now();
    }
  }
}
