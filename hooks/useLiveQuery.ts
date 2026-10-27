"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getServices } from "@/services";
import { createLiveQuery, type LiveState } from "./liveQuery";

/** Lê dos services e se atualiza a cada gravação (na mesma aba). */
export function useLiveQuery<T>(query: () => Promise<T>, deps: readonly unknown[] = []) {
  const [state, setState] = useState<LiveState<T>>({ loading: true });
  const queryRef = useRef(query);
  queryRef.current = query;
  const ctl = useRef<ReturnType<typeof createLiveQuery<T>> | null>(null);

  useEffect(() => {
    const live = createLiveQuery<T>({ query: () => queryRef.current(), onState: setState });
    ctl.current = live;
    live.start();
    let unsub: (() => void) | undefined;
    try { unsub = getServices().subscribe(() => live.invalidate()); } catch { /* sem IndexedDB: o erro aparece na leitura */ }
    return () => { unsub?.(); live.dispose(); ctl.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const reload = useCallback(() => ctl.current?.reload(), []);
  return { ...state, reload };
}
