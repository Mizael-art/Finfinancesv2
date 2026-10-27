"use client";

import { useLiveQuery } from "@/hooks/useLiveQuery";
import { getServices } from "@/services";

/** Metas com progresso e situação. Atualiza a cada gravação. */
export function useGoalsData() {
  return useLiveQuery(() => getServices().goals.overview(), []);
}
