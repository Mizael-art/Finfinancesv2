"use client";

import { useLiveQuery } from "@/hooks/useLiveQuery";
import { getServices } from "@/services";

/** Configurações e perfil (atualiza a cada gravação). */
export function useSettingsData() {
  return useLiveQuery(async () => {
    const s = getServices();
    const [settings, user] = await Promise.all([s.settings.get(), s.users.getCurrent()]);
    return { settings, user };
  }, []);
}

/** Primeiro dia do mês financeiro. Enquanto carrega (ou se falhar), vale 1 (mês de calendário). */
export function useFirstDay(): number {
  const { data } = useLiveQuery(() => getServices().settings.get(), []);
  return data?.firstDayOfMonth ?? 1;
}
