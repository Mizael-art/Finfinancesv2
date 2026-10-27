import type { Category, CategoryKind } from "@/types/domain";

export interface CategoryOverviewItem {
  category: Category;
  periodCents: number;
  periodCount: number;
  usage: { transactions: number; budgets: number; recurrences: number };
}

export interface CategoryRow extends CategoryOverviewItem {
  /** Fatia do total do período (0–100), para a barrinha. */
  sharePercent: number;
  usageTotal: number;
}

export const usageTotal = (u: CategoryOverviewItem["usage"]) => u.transactions + u.budgets + u.recurrences;

/** Linhas de um tipo: maiores valores primeiro; sem movimento no fim, em ordem alfabética. */
export function buildCategoryRows(items: CategoryOverviewItem[], kind: CategoryKind): { rows: CategoryRow[]; totalCents: number } {
  const mine = items.filter((i) => i.category.kind === kind);
  const totalCents = mine.reduce((s, i) => s + i.periodCents, 0);
  const rows = mine
    .map((i): CategoryRow => ({ ...i, usageTotal: usageTotal(i.usage), sharePercent: totalCents > 0 ? Math.round((i.periodCents / totalCents) * 100) : 0 }))
    .sort((a, b) => b.periodCents - a.periodCents || a.category.name.localeCompare(b.category.name, "pt-BR"));
  return { rows, totalCents };
}

/** "3 transações", "1 transação", "Sem movimento". */
export function movementLabel(count: number): string {
  if (count === 0) return "Sem movimento";
  return count === 1 ? "1 transação" : `${count} transações`;
}

/** Onde a categoria é usada, em português, para avisar antes de excluir. */
export function usageSentence(u: CategoryOverviewItem["usage"]): string {
  const parts: string[] = [];
  if (u.transactions) parts.push(u.transactions === 1 ? "1 transação" : `${u.transactions} transações`);
  if (u.budgets) parts.push(u.budgets === 1 ? "1 orçamento" : `${u.budgets} orçamentos`);
  if (u.recurrences) parts.push(u.recurrences === 1 ? "1 repetição" : `${u.recurrences} repetições`);
  return parts.join(", ").replace(/, ([^,]*)$/, " e $1");
}
