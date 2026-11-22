import { monthKey } from "@/lib/date";
import type { Category, Invoice, Transaction } from "@/types/domain";
import type { PlanMonth } from "./projection";

export interface CategorySlice {
  /** Id da categoria; "dia-a-dia" = estimativa dos gastos do dia a dia; "sem-categoria" = item sem categoria. */
  id: string;
  name: string;
  color?: string;
  cents: number;
  /** Fatia do total de despesas do mês (0–100). */
  percent: number;
  /** É estimativa (não um lançamento ou despesa cadastrada). */
  estimate?: boolean;
}

/** Despesas previstas do mês por categoria, da maior para a menor. A estimativa do dia a dia vira uma fatia própria. */
export function categoryBreakdown(month: PlanMonth, categories: Pick<Category, "id" | "name" | "color">[]): CategorySlice[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const sums = new Map<string, number>();
  for (const i of month.items) {
    if (i.group === "renda") continue;
    const key = i.categoryId && byId.has(i.categoryId) ? i.categoryId : "sem-categoria";
    sums.set(key, (sums.get(key) ?? 0) + i.cents);
  }
  const slices: Omit<CategorySlice, "percent">[] = [...sums].map(([id, cents]) => {
    const cat = byId.get(id);
    return { id, name: cat?.name ?? "Sem categoria", color: cat?.color, cents };
  });
  if (month.variableCents > 0) slices.push({ id: "dia-a-dia", name: "Dia a dia (estimativa)", cents: month.variableCents, estimate: true });
  const total = slices.reduce((s, x) => s + x.cents, 0);
  return slices
    .map((x) => ({ ...x, percent: total > 0 ? Math.round((x.cents / total) * 100) : 0 }))
    .sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name, "pt-BR"));
}

/**
 * Compras no cartão que já aconteceram (até hoje) e ainda estão em faturas não pagas, somadas pelo mês de vencimento
 * da fatura. Elas ainda não saíram do saldo das contas e também não estão no planejamento (que só olha o futuro).
 */
export function pendingCardDebtByMonth(
  transactions: Pick<Transaction, "type" | "cardId" | "invoiceId" | "date" | "amountCents">[],
  invoices: Pick<Invoice, "id" | "dueDate" | "paidAt">[],
  today: string,
): Map<string, number> {
  const unpaid = new Map(invoices.filter((i) => !i.paidAt).map((i) => [i.id, monthKey(i.dueDate)]));
  const out = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "despesa" || !t.cardId || !t.invoiceId || t.date > today) continue;
    const key = unpaid.get(t.invoiceId);
    if (key) out.set(key, (out.get(key) ?? 0) + t.amountCents);
  }
  return out;
}

export interface MonthBalance {
  key: string;
  /** Saldo somado das contas no início do mês (previsto). */
  startCents: number;
  /** Faturas de compras já feitas que vencem neste mês (saem da conta). */
  cardDebtCents: number;
  /** Saldo somado das contas no fim do mês (previsto). */
  endCents: number;
}

/**
 * Saldo previsto das contas mês a mês: parte do saldo de hoje, soma a sobra prevista de cada mês e tira as faturas
 * de compras já feitas no mês em que vencem (fatura vencida entra no primeiro mês). `plan` deve estar em ordem e
 * começar no mês atual.
 */
export function projectBalances(startCents: number, plan: Pick<PlanMonth, "key" | "balanceCents">[], cardDebt: Map<string, number>): MonthBalance[] {
  const first = plan[0]?.key;
  const debtIn = (key: string) => {
    let cents = cardDebt.get(key) ?? 0;
    if (key === first) for (const [k, v] of cardDebt) if (k < key) cents += v; // faturas atrasadas
    return cents;
  };
  let running = startCents;
  return plan.map((m) => {
    const cardDebtCents = debtIn(m.key);
    const start = running;
    running = running + m.balanceCents - cardDebtCents;
    return { key: m.key, startCents: start, cardDebtCents, endCents: running };
  });
}
