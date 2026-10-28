"use client";

import { useLiveQuery } from "@/hooks/useLiveQuery";
import { getServices } from "@/services";
import { buildUpcoming } from "./upcoming";

/** Contas e faturas a vencer nos próximos meses. Atualiza sozinho quando você paga ou lança algo. */
export function useUpcoming(today: string, months = 3) {
  return useLiveQuery(async () => {
    const s = getServices();
    const [recurrences, invoices] = await Promise.all([s.recurrences.list(), s.invoices.views({ today })]);
    return buildUpcoming({ today, recurrences, invoices, months });
  }, [today, months]);
}
