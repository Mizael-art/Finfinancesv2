import type { ChangeEvent } from "./types";

export function createEmitter() {
  const listeners = new Set<(e: ChangeEvent) => void>();
  return {
    subscribe(fn: (e: ChangeEvent) => void) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    emit(event: ChangeEvent) {
      for (const fn of [...listeners]) {
        try { fn(event); } catch { /* um ouvinte com erro não pode travar os outros */ }
      }
    },
  };
}
