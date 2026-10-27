"use client";

import { useLiveQuery } from "@/hooks/useLiveQuery";
import { getServices } from "@/services";

/** Transações de um período + nomes de categorias/contas/cartões. Atualiza sozinho a cada gravação. */
export function useTransactionsData(range: { from?: string; to?: string }) {
  return useLiveQuery(async () => {
    const s = getServices();
    const [transactions, categories, accounts, cards, total] = await Promise.all([
      s.transactions.list(range),
      s.categories.list(),
      s.accounts.list({ includeArchived: true }),
      s.cards.list({ includeArchived: true }),
      s.transactions.count(),
    ]);
    return { transactions, categories, accounts, cards, total };
  }, [range.from, range.to]);
}
