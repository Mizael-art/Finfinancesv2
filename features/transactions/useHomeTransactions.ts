"use client";

import { useLiveQuery } from "@/hooks/useLiveQuery";
import { todayISODate } from "@/lib/date";
import { getServices } from "@/services";
import { summarizeTransactions } from "@/services/transactions/rules";
import { rangeFor } from "./periods";

const RECENT = 5;

/** Resumo do mês e as últimas transações (sem as futuras) para o Início. */
export function useHomeTransactions() {
  return useLiveQuery(async () => {
    const s = getServices();
    const today = todayISODate();
    const settings = await s.settings.get();
    const firstDay = settings.firstDayOfMonth;
    const [month, upToToday, categories, accounts, cards, total] = await Promise.all([
      s.transactions.list(rangeFor("mes", today, firstDay)),
      s.transactions.list({ to: today }),
      s.categories.list(),
      s.accounts.list({ includeArchived: true }),
      s.cards.list({ includeArchived: true }),
      s.transactions.count(),
    ]);
    const summary = summarizeTransactions(month);
    return {
      incomeCents: summary.incomeCents,
      expenseCents: summary.expenseCents,
      monthlyLimitCents: settings.monthlyLimitCents ?? 0,
      total,
      recent: upToToday.slice(0, RECENT),
      lookups: { categories, accounts, cards },
    };
  }, []);
}
