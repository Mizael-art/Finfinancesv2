import { fromCents } from "@/lib/money";
import type { Budget as BudgetCardModel } from "@/types/finance";
import type { BudgetItem } from "@/services/budgets/compute";

/** Domínio (centavos) → props do BudgetCard (reais), só na fronteira da UI. */
export function toBudgetCard(item: BudgetItem, periodLabel: string): BudgetCardModel {
  return {
    id: item.budget.id,
    category: item.category.name,
    limit: fromCents(item.budget.limitCents),
    spent: fromCents(item.spentCents),
    period: periodLabel,
    color: item.category.color,
  };
}

/** Quantos orçamentos pedem atenção (≥ 80%), para o resumo. */
export function attentionCount(items: BudgetItem[]): number {
  return items.filter((i) => i.status !== "ok").length;
}

export const attentionSentence = (n: number): string =>
  n === 0 ? "Tudo dentro do planejado." : n === 1 ? "1 orçamento pede atenção." : `${n} orçamentos pedem atenção.`;
