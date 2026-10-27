/**
 * Lógica pura de uma consulta reativa (testada sem React):
 * - agrupa mudanças seguidas numa leitura só;
 * - ignora resposta velha (a última leitura pedida é a que vale);
 * - se uma releitura falha, mantém os últimos dados bons e informa o erro.
 */
export interface LiveState<T> {
  data?: T;
  error?: unknown;
  loading: boolean;
}

export function createLiveQuery<T>(opts: {
  query: () => Promise<T>;
  onState: (state: LiveState<T>) => void;
  /** Espera (ms) para agrupar gravações seguidas. */
  debounceMs?: number;
}) {
  let seq = 0;
  let current: LiveState<T> = { loading: true };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const emit = (next: LiveState<T>) => { current = next; if (!disposed) opts.onState(next); };

  async function run() {
    const mine = ++seq;
    try {
      const data = await opts.query();
      if (mine === seq) emit({ data, loading: false });
    } catch (error) {
      if (mine === seq) emit({ data: current.data, error, loading: false });
    }
  }

  return {
    start: () => { emit({ ...current, loading: true, error: undefined }); void run(); },
    invalidate() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void run(), opts.debounceMs ?? 20);
    },
    reload: () => { emit({ ...current, loading: true, error: undefined }); void run(); },
    dispose() { disposed = true; if (timer) clearTimeout(timer); },
  };
}
