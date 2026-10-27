import type { Budget, Category, Transaction } from "@/types/domain";

export type BudgetStatus = "ok" | "atencao" | "estourado";

/** Mesma escala da barra (progressColor): 80% = atenção, 100% = estourado. */
export function budgetStatus(spentCents: number, limitCents: number): BudgetStatus {
  const pct = limitCents > 0 ? (spentCents / limitCents) * 100 : spentCents > 0 ? 100 : 0;
  return pct >= 100 ? "estourado" : pct >= 80 ? "atencao" : "ok";
}

/** Despesas por categoria no período (compra no cartão entra; transferência e pagamento de fatura não). */
export function spentByCategory(txs: Transaction[], range: { from: string; to: string }): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== "despesa" || !t.categoryId || t.date < range.from || t.date > range.to) continue;
    out.set(t.categoryId, (out.get(t.categoryId) ?? 0) + t.amountCents);
  }
  return out;
}

export interface BudgetItem {
  budget: Budget;
  category: Category;
  spentCents: number;
  /** Pode ser negativo (estourou). */
  remainingCents: number;
  /** Porcentagem real (pode passar de 100). */
  percent: number;
  status: BudgetStatus;
}

export interface BudgetOverview {
  range: { from: string; to: string };
  items: BudgetItem[];
  totalLimitCents: number;
  totalSpentCents: number;
  /** Categorias de despesa com gasto no período e sem orçamento, maiores primeiro. */
  unbudgeted: { category: Category; spentCents: number }[];
}

export function buildBudgetOverview(budgets: Budget[], categories: Category[], txs: Transaction[], range: { from: string; to: string }): BudgetOverview {
  const spent = spentByCategory(txs, range);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const items: BudgetItem[] = [];
  for (const budget of budgets) {
    const category = byId.get(budget.categoryId);
    if (!category) continue; // orçamento órfão (dado importado): não aparece
    const spentCents = spent.get(budget.categoryId) ?? 0;
    items.push({
      budget, category, spentCents,
      remainingCents: budget.limitCents - spentCents,
      percent: budget.limitCents > 0 ? Math.round((spentCents / budget.limitCents) * 100) : 0,
      status: budgetStatus(spentCents, budget.limitCents),
    });
  }
  items.sort((a, b) => b.percent - a.percent || a.category.name.localeCompare(b.category.name, "pt-BR"));
  const budgeted = new Set(budgets.map((b) => b.categoryId));
  const unbudgeted = [...spent.entries()]
    .filter(([id, cents]) => !budgeted.has(id) && cents > 0 && byId.get(id)?.kind === "despesa")
    .map(([id, spentCents]) => ({ category: byId.get(id)!, spentCents }))
    .sort((a, b) => b.spentCents - a.spentCents);
  return {
    range, items, unbudgeted,
    totalLimitCents: items.reduce((s, i) => s + i.budget.limitCents, 0),
    totalSpentCents: items.reduce((s, i) => s + i.spentCents, 0),
  };
}

/** Média mensal de gasto na categoria nos `months` meses anteriores (arredondada), para sugerir um limite. */
export function averageMonthlySpend(txs: Transaction[], categoryId: string, ranges: { from: string; to: string }[]): number {
  if (ranges.length === 0) return 0;
  const total = ranges.reduce((s, r) => s + (spentByCategory(txs, r).get(categoryId) ?? 0), 0);
  return Math.round(total / ranges.length);
}
