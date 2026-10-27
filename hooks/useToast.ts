"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Aviso de sucesso que some sozinho. */
export function useToast(durationMs = 3200) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((text: string) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), durationMs);
  }, [durationMs]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { message, show };
}
