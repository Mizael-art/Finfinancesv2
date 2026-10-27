/** Resultado de uma tentativa de backup, do ponto de vista do agendador. */
export type RunOutcome = "ok" | "offline" | "blocked" | "error";

export interface SchedulerOptions {
  run: () => Promise<RunOutcome>;
  /** Espera depois da última alteração antes de enviar. */
  delayMs?: number;
  /** Mesmo com alterações sem parar, envia no máximo depois disso. */
  maxWaitMs?: number;
  /** Tentativas seguintes após erro inesperado. */
  retryMs?: number;
  maxRetries?: number;
  onPending?: (pending: boolean) => void;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (h: unknown) => void;
}

/**
 * Junta várias alterações seguidas em UM backup (debounce + espera máxima) e serializa os envios.
 * Offline ou sem permissão: não tenta em loop; fica "pendente" até `resume()` (conexão voltou / usuário reconectou).
 */
export function createBackupScheduler(opts: SchedulerOptions) {
  const delayMs = opts.delayMs ?? 8_000;
  const maxWaitMs = opts.maxWaitMs ?? 60_000;
  const retryMs = opts.retryMs ?? 120_000;
  const maxRetries = opts.maxRetries ?? 3;
  const now = opts.now ?? Date.now;
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));

  let dirty = false;
  let running = false;
  let firstDirtyAt = 0;
  let timer: unknown = null;
  let retries = 0;
  let enabled = true;
  let changeSeq = 0;

  const setDirty = (v: boolean) => { if (dirty !== v) { dirty = v; opts.onPending?.(v); } };
  const stopTimer = () => { if (timer !== null) { clearTimer(timer); timer = null; } };

  function schedule(ms: number) {
    stopTimer();
    timer = setTimer(() => { timer = null; void fire(); }, Math.max(0, ms));
  }

  async function fire(): Promise<void> {
    if (!enabled || !dirty) return;
    if (running) return; // quando o envio atual terminar, ele reavalia
    running = true;
    stopTimer();
    // Alterações que chegarem durante o envio contam para o próximo.
    const seqAtStart = changeSeq;
    let outcome: RunOutcome;
    try { outcome = await opts.run(); } catch { outcome = "error"; }
    running = false;
    if (outcome === "ok") {
      retries = 0;
      // Só considera "limpo" se nada novo chegou durante o envio.
      if (changeSeq !== seqAtStart) { firstDirtyAt = now(); schedule(delayMs); } else setDirty(false);
    } else if (outcome === "error" && retries < maxRetries) {
      retries++;
      schedule(retryMs);
    }
    // offline / blocked / erro esgotado: continua pendente, sem timer, até resume().
  }

  return {
    /** Houve uma alteração relevante nos dados. */
    notify() {
      if (!enabled) return;
      changeSeq++;
      if (!dirty) { firstDirtyAt = now(); setDirty(true); }
      if (running) return; // o fim do envio agenda o seguinte
      schedule(Math.min(delayMs, Math.max(0, firstDirtyAt + maxWaitMs - now())));
    },
    /** Conexão voltou / usuário reconectou: tenta já o que ficou pendente. */
    resume() {
      if (!enabled || !dirty) return;
      retries = 0;
      schedule(0);
    },
    /** Marca como pendente sem alteração nova (ex.: backup manual falhou por estar offline). */
    markPending() { if (!dirty) firstDirtyAt = now(); setDirty(true); },
    /** Backup manual deu certo: nada mais pendente (se não chegou nada novo). */
    clear() { stopTimer(); retries = 0; if (!running) setDirty(false); },
    setEnabled(v: boolean) { enabled = v; if (!v) { stopTimer(); setDirty(false); retries = 0; } },
    get pending() { return dirty; },
    get running() { return running; },
    dispose() { enabled = false; stopTimer(); },
  };
}
export type BackupScheduler = ReturnType<typeof createBackupScheduler>;
