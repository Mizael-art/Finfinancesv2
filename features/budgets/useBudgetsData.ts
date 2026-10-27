"use client";

import { useLiveQuery } from "@/hooks/useLiveQuery";
import { getServices } from "@/services";
import type { MonthKey } from "@/lib/financialMonth";

/** Orçamentos do mês (null = mês financeiro atual) com gasto. Atualiza a cada gravação. */
export function useBudgetsData(month: MonthKey | null) {
  return useLiveQuery(() => getServices().budgets.overview(month ?? undefined), [month]);
}
