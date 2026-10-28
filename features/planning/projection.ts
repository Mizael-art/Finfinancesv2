import { addMonths, clampedDate, endOfMonth, monthKey, startOfMonth } from "@/lib/date";
import { occurrencesUpTo } from "@/services/recurrences/schedule";
import type { IncomeSource, Recurrence, Transaction } from "@/types/domain";

/** De onde vem cada item previsto. */
export type PlanGroup = "fixa" | "parcela" | "lancada" | "renda";

export const PLAN_GROUP_ORDER: PlanGroup[] = ["fixa", "parcela", "lancada", "renda"];
export const PLAN_GROUP_LABEL: Record<PlanGroup, string> = {
  fixa: "Despesas fixas",
  parcela: "Parcelas no cartão",
  lancada: "Outras despesas já lançadas",
  renda: "Receitas previstas",
};

/** `txId`: quando o item é um lançamento real (dá para abrir, editar ou apagar). */
export interface PlanItem { id: string; group: PlanGroup; label: string; date: string; cents: number; txId?: string }

export interface PlanMonth {
  /** "YYYY-MM" */
  key: string;
  items: PlanItem[];
  /** Estimativa de gastos do dia a dia (média dos últimos meses). Já está dentro de `expenseCents`. */
  variableCents: number;
  incomeCents: number;
  expenseCents: number;
  /** Receitas previstas − despesas previstas. */
  balanceCents: number;
  byGroup: Record<PlanGroup, number>;
}

export interface PlanInput {
  /** Hoje (YYYY-MM-DD): só entra o que vem DEPOIS de hoje. */
  today: string;
  /** Quantos meses depois do atual (o mês atual entra só com o que ainda falta). */
  months: number;
  transactions: Transaction[];
  recurrences: Recurrence[];
  incomes: IncomeSource[];
  /** Média mensal dos gastos do dia a dia (0 = não estimar). */
  variableMonthlyCents?: number;
  /** Quanto desse tipo de gasto já aconteceu neste mês (abate da estimativa do mês atual). */
  variableSoFarCents?: number;
}

/** Último dia coberto pelo planejamento. */
export const planHorizonEnd = (today: string, months: number): string => endOfMonth(addMonths(startOfMonth(today), months));

/**
 * Previsão dos próximos meses a partir do que já está cadastrado:
 * compras e parcelas com data futura, despesas/receitas que se repetem (ainda não lançadas) e rendas fixas.
 * Gastos do dia a dia que ainda não aconteceram não entram — não dá para saber quais serão.
 */
export function buildPlan({ today, months, transactions, recurrences, incomes, variableMonthlyCents = 0, variableSoFarCents = 0 }: PlanInput): PlanMonth[] {
  const end = planHorizonEnd(today, months);
  const keys = Array.from({ length: months + 1 }, (_, i) => monthKey(addMonths(startOfMonth(today), i)));
  const buckets = new Map<string, PlanItem[]>(keys.map((k) => [k, []]));
  const add = (item: PlanItem) => { buckets.get(monthKey(item.date))?.push(item); };

  for (const t of transactions) {
    if (t.date <= today || t.date > end) continue;
    if (t.type === "despesa") {
      const label = t.installmentTotal ? `${t.description} (${t.installmentNumber}/${t.installmentTotal})` : t.description;
      add({ id: t.id, group: t.installmentGroupId ? "parcela" : "lancada", label, date: t.date, cents: t.amountCents, txId: t.id });
    } else if (t.type === "receita") {
      add({ id: t.id, group: "renda", label: t.description, date: t.date, cents: t.amountCents, txId: t.id });
    }
  }

  for (const r of recurrences) {
    if (!r.active) continue;
    const after = r.lastGeneratedDate && r.lastGeneratedDate > today ? r.lastGeneratedDate : today;
    for (const date of occurrencesUpTo({ ...r, lastGeneratedDate: after }, end)) {
      add({ id: `${r.id}:${date}`, group: r.type === "despesa" ? "fixa" : "renda", label: r.description, date, cents: r.amountCents });
    }
  }

  for (const inc of incomes) {
    if (inc.kind !== "fixa") continue;
    for (const key of keys) {
      const [y, m] = key.split("-").map(Number);
      const date = clampedDate(y, m, inc.payDay);
      if (date > today && date <= end) add({ id: `${inc.id}:${date}`, group: "renda", label: inc.name, date, cents: inc.amountCents });
    }
  }

  const currentKey = monthKey(today);
  return keys.map((key) => {
    const variableCents = key === currentKey ? Math.max(0, variableMonthlyCents - variableSoFarCents) : variableMonthlyCents;
    const items = (buckets.get(key) ?? []).sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label, "pt-BR"));
    const byGroup: Record<PlanGroup, number> = { fixa: 0, parcela: 0, lancada: 0, renda: 0 };
    for (const i of items) byGroup[i.group] += i.cents;
    const incomeCents = byGroup.renda;
    const expenseCents = byGroup.fixa + byGroup.parcela + byGroup.lancada + variableCents;
    return { key, items, variableCents, incomeCents, expenseCents, balanceCents: incomeCents - expenseCents, byGroup };
  });
}

export interface VariableEstimate {
  /** Média mensal dos gastos do dia a dia nos últimos meses completos com movimento. */
  monthlyCents: number;
  /** Quanto já foi gasto assim neste mês até hoje. */
  soFarCents: number;
  /** Em quantos meses a média se baseia (0 = sem histórico). */
  monthsUsed: number;
}

/**
 * Gastos do dia a dia = despesas que não são parcelas nem lançamentos automáticos de despesa fixa
 * (esses já entram na previsão por conta própria). Média dos últimos `monthsBack` meses completos que tiveram movimento.
 */
export function estimateVariable(transactions: Transaction[], today: string, monthsBack = 3): VariableEstimate {
  const current = monthKey(today);
  const wanted = Array.from({ length: monthsBack }, (_, i) => monthKey(addMonths(startOfMonth(today), -(i + 1))));
  const withData = new Set<string>();
  const sums = new Map<string, number>();
  let soFarCents = 0;
  for (const t of transactions) {
    const k = monthKey(t.date);
    if (wanted.includes(k)) withData.add(k);
    if (t.type !== "despesa" || t.installmentGroupId || t.recurrenceId) continue;
    if (wanted.includes(k)) sums.set(k, (sums.get(k) ?? 0) + t.amountCents);
    else if (k === current && t.date <= today) soFarCents += t.amountCents;
  }
  const monthsUsed = withData.size;
  const total = [...sums.values()].reduce((s, v) => s + v, 0);
  return { monthlyCents: monthsUsed > 0 ? Math.round(total / monthsUsed) : 0, soFarCents, monthsUsed };
}
