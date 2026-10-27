import type { Storage } from "@/storage/types";
import { expensesByCategory, previousRange, topExpenses, totals, type DateRange } from "./compute";

export function createReportsService(storage: Storage) {
  return {
    /** Tudo que a tela de Relatórios mostra, calculado a partir das transações do período. */
    async overview(range: DateRange = {}) {
      const [txs, categories] = await Promise.all([storage.repo("transactions").list(), storage.repo("categories").list()]);
      const prev = previousRange(range);
      return {
        range,
        ...totals(txs, range),
        categories: expensesByCategory(txs, categories, range),
        top: topExpenses(txs, categories, range),
        previous: prev ? { range: prev, expenseCents: totals(txs, prev).expenseCents, incomeCents: totals(txs, prev).incomeCents } : null,
      };
    },
  };
}
export type ReportsService = ReturnType<typeof createReportsService>;
