import { addDays, addMonths, monthName } from "@/lib/date";
import { fromCents } from "@/lib/money";
import type { CategorySlice, TopExpense } from "@/services/reports/compute";
import type { Transaction as TransactionItemData } from "@/types/finance";

/** Fatias → props do donut (reais só aqui). */
export const toDonutSlices = (slices: CategorySlice[]) =>
  slices.map((s) => ({ category: s.name, pct: s.percent, color: s.color, amount: fromCents(s.cents) }));

/** Maiores despesas → props da lista de destaques. */
export const toTopItems = (top: TopExpense[]): TransactionItemData[] =>
  top.map(({ transaction: t, categoryName, color }) => ({
    id: t.id, description: t.description, amount: fromCents(t.amountCents), type: "despesa",
    category: categoryName, categoryColor: color, account: "", date: t.date,
  }));

/** Rótulos "anterior vs atual": mês único usa o nome do mês; senão "Período anterior" / "Este período". */
export function comparisonLabels(range: { from?: string; to?: string }, prev: { from: string; to: string } | undefined | null) {
  if (!prev || !range.from || !range.to) return null;
  // um mês inteiro (de calendário ou financeiro, ex.: 10/10 a 09/11) é nomeado pelo mês em que começa
  const single = addMonths(range.from, 1) === addDays(range.to, 1);
  const sameYear = range.from.slice(0, 4) === range.to.slice(0, 4) && range.from.slice(5, 7) === "01" && range.to.slice(5, 7) === "12";
  if (single) return { previous: monthName(prev.from), current: monthName(range.from) };
  if (sameYear) return { previous: prev.from.slice(0, 4), current: range.from.slice(0, 4) };
  return { previous: "Período anterior", current: "Este período" };
}

/** Variação dos gastos frente ao período anterior, em texto. null quando não há base de comparação. */
export function changeSentence(currentCents: number, previousCents: number): string | null {
  if (previousCents <= 0) return null;
  const pct = Math.round(((currentCents - previousCents) / previousCents) * 100);
  if (pct === 0) return "Gastos iguais ao período anterior.";
  if (pct >= 1000) return "Você gastou mais de 10 vezes o valor do período anterior.";
  return pct < 0 ? `Você gastou ${Math.abs(pct)}% a menos que no período anterior.` : `Você gastou ${pct}% a mais que no período anterior.`;
}
