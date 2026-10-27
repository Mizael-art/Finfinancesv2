"use client";

import { useCallback } from "react";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { getServices } from "@/services";
import { applyTheme } from "./apply";
import { normalizeTheme, type ThemeId } from "./themes";

/** Tema ativo (vindo das configurações) e a função para trocá-lo na hora, sem recarregar a página. */
export function useTheme() {
  const { data, error, reload } = useLiveQuery(() => getServices().settings.get(), []);
  const current: ThemeId | undefined = data ? normalizeTheme(data.theme) : undefined;
  const setTheme = useCallback(async (id: ThemeId) => {
    applyTheme(id); // troca imediata; a gravação vem em seguida
    await getServices().settings.update({ theme: id });
  }, []);
  return { theme: current, setTheme, error, reload };
}
