"use client";

import { useLiveQuery } from "@/hooks/useLiveQuery";
import { getServices } from "@/services";

/** Relatório do período (datas "YYYY-MM-DD"; sem limites = tudo). Atualiza a cada gravação. */
export function useReportsData(range: { from?: string; to?: string }) {
  return useLiveQuery(() => getServices().reports.overview(range), [range.from, range.to]);
}
