"use client";

import { useLiveQuery } from "@/hooks/useLiveQuery";
import { todayISODate } from "@/lib/date";
import { getServices } from "@/services";

/** Cartões com limite/fatura atual + contas (para escolher onde pagar). Atualiza sozinho a cada gravação. */
export function useCardsOverview() {
  return useLiveQuery(async () => {
    const s = getServices();
    const today = todayISODate();
    const [cards, views, accounts, all] = await Promise.all([
      s.cards.overview({ today }),
      s.invoices.views({ today }),
      s.accounts.listWithBalances(),
      s.cards.list({ includeArchived: true }),
    ]);
    const archived = all.filter((c) => c.archivedAt);
    return { cards, archived, views, accounts, today };
  }, []);
}
