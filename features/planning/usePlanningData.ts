"use client";

import { useMemo } from "react";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { monthKey, todayISODate } from "@/lib/date";
import { getServices } from "@/services";
import { pendingCardDebtByMonth, projectBalances, type MonthBalance } from "./monthDetail";
import { buildPlan, estimateVariable } from "./projection";

/**
 * Tudo que o Planejamento e a tela de um mês precisam: a previsão (a partir do mês atual), a estimativa do dia a dia,
 * o saldo previsto das contas no fim de cada mês e as faturas a pagar por mês de vencimento.
 */
export function usePlanningData(months: number, withEstimate: boolean) {
  const query = useLiveQuery(async () => {
    const s = getServices();
    const today = todayISODate();
    const [transactions, recurrences, incomes, goals, invoiceViews, invoices, categories, overview] = await Promise.all([
      s.transactions.list(), s.recurrences.list(), s.income.list(), s.goals.list(), s.invoices.views({ today }),
      s.invoices.list(), s.categories.list(), s.accounts.overview(),
    ]);
    return { today, transactions, recurrences, incomes, goals, invoiceViews, invoices, categories, netWorthCents: overview.netWorthCents };
  }, []);
  const { data } = query;

  const estimate = useMemo(() => (data ? estimateVariable(data.transactions, data.today) : null), [data]);

  const computed = useMemo(() => {
    if (!data || !estimate) return null;
    const plan = buildPlan({ ...data, months, variableMonthlyCents: withEstimate ? estimate.monthlyCents : 0, variableSoFarCents: estimate.soFarCents });
    const debt = pendingCardDebtByMonth(data.transactions, data.invoices, data.today);
    const balances = new Map<string, MonthBalance>(projectBalances(data.netWorthCents, plan, debt).map((b) => [b.key, b]));
    // Faturas de cartão por mês de vencimento: só informativo (as compras já contam nos gastos do mês em que foram feitas).
    const invoicesByMonth = new Map<string, typeof data.invoiceViews>();
    for (const v of data.invoiceViews) {
      if (v.status === "paga" || v.totalCents <= 0) continue;
      const k = monthKey(v.invoice.dueDate);
      invoicesByMonth.set(k, [...(invoicesByMonth.get(k) ?? []), v]);
    }
    return { plan, balances, invoicesByMonth };
  }, [data, estimate, months, withEstimate]);

  return { ...query, estimate, plan: computed?.plan ?? null, balances: computed?.balances ?? null, invoicesByMonth: computed?.invoicesByMonth ?? null };
}
