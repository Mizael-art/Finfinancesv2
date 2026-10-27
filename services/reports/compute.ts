import { addDays, addMonths } from "@/lib/date";
import type { Category, Transaction } from "@/types/domain";

export interface DateRange { from?: string; to?: string }

export interface CategorySlice {
  /** null = despesas sem categoria; "outras" = categorias menores agrupadas. */
  categoryId: string | null;
  name: string;
  color: string;
  cents: number;
  /** Inteiro; as fatias somam exatamente 100. */
  percent: number;
}

export interface TopExpense { transaction: Transaction; categoryName: string; color: string }

export const NO_CATEGORY_COLOR = "#9AA0A8";
export const MAX_SLICES = 6;

export const inRange = (date: string, r: DateRange) => (!r.from || date >= r.from) && (!r.to || date <= r.to);

/**
 * Período imediatamente anterior, com o mesmo número de meses (mês → mês anterior, ano → ano anterior).
 * Funciona para mês de calendário e para "mês financeiro" que começa em outro dia. Sem limites = null.
 */
export function previousRange(r: DateRange): { from: string; to: string } | null {
  if (!r.from || !r.to) return null;
  const end = addDays(r.to, 1);
  const months = Math.max(1, (Number(end.slice(0, 4)) - Number(r.from.slice(0, 4))) * 12 + Number(end.slice(5, 7)) - Number(r.from.slice(5, 7)));
  return { from: addMonths(r.from, -months), to: addDays(r.from, -1) };
}

/** Receita e despesa do período. Transferência e pagamento de fatura nunca entram. */
export function totals(txs: Transaction[], r: DateRange) {
  let incomeCents = 0, expenseCents = 0, count = 0;
  for (const t of txs) {
    if ((t.type !== "receita" && t.type !== "despesa") || !inRange(t.date, r)) continue;
    count++;
    if (t.type === "receita") incomeCents += t.amountCents; else expenseCents += t.amountCents;
  }
  return { incomeCents, expenseCents, resultCents: incomeCents - expenseCents, count };
}

/** Inteiros que somam 100 (maior resto). */
export function percentages(values: number[]): number[] {
  const total = values.reduce((s, v) => s + v, 0);
  if (total <= 0) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 100);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((s, v) => s + v, 0);
  raw.map((r, i) => ({ i, rest: r - Math.floor(r) })).sort((a, b) => b.rest - a.rest || a.i - b.i).forEach(({ i }) => { if (left-- > 0) out[i]++; });
  return out;
}

/** Despesas por categoria, maiores primeiro; além de MAX_SLICES, o resto vira "Outras categorias". */
export function expensesByCategory(txs: Transaction[], categories: Category[], r: DateRange): CategorySlice[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const sums = new Map<string | null, number>();
  for (const t of txs) {
    if (t.type !== "despesa" || !inRange(t.date, r)) continue;
    const key = t.categoryId && byId.has(t.categoryId) ? t.categoryId : null;
    sums.set(key, (sums.get(key) ?? 0) + t.amountCents);
  }
  const rows = [...sums.entries()]
    .map(([id, cents]) => ({ categoryId: id, name: id ? byId.get(id)!.name : "Sem categoria", color: (id && byId.get(id)!.color) || NO_CATEGORY_COLOR, cents }))
    .sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name, "pt-BR"));
  let shown = rows;
  if (rows.length > MAX_SLICES) {
    const rest = rows.slice(MAX_SLICES - 1);
    shown = [...rows.slice(0, MAX_SLICES - 1), { categoryId: "outras", name: "Outras categorias", color: NO_CATEGORY_COLOR, cents: rest.reduce((s, x) => s + x.cents, 0) }];
  }
  const pct = percentages(shown.map((s) => s.cents));
  return shown.map((s, i) => ({ ...s, percent: pct[i] }));
}

/** As maiores despesas do período (compras no cartão incluídas). */
export function topExpenses(txs: Transaction[], categories: Category[], r: DateRange, limit = 4): TopExpense[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  return txs
    .filter((t) => t.type === "despesa" && inRange(t.date, r))
    .sort((a, b) => b.amountCents - a.amountCents || b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
    .slice(0, limit)
    .map((t) => {
      const c = t.categoryId ? byId.get(t.categoryId) : undefined;
      return { transaction: t, categoryName: c?.name ?? "Sem categoria", color: c?.color ?? NO_CATEGORY_COLOR };
    });
}
