import { addDays, addMonths, endOfMonth, monthKey, startOfMonth } from "@/lib/date";
import { occurrencesUpTo } from "@/services/recurrences/schedule";
import type { Recurrence } from "@/types/domain";

export type BillStatus = "paga" | "atrasada" | "hoje" | "pendente";

/** Um vencimento de uma despesa fixa (ex.: o aluguel de 05/11). */
export interface Bill { key: string; recurrence: Recurrence; dueDate: string; paid: boolean; status: BillStatus }

/** Só mensal e anual viram "conta" com vencimento (diária e semanal não têm um dia no mês). */
const isBillFrequency = (r: Recurrence) => r.frequency === "mensal" || r.frequency === "anual";

/** Vencimentos das despesas fixas ativas dentro do mês `key` ("YYYY-MM"), por data. */
export function billsInMonth(recurrences: Recurrence[], key: string, today: string): Bill[] {
  const monthEnd = endOfMonth(`${key}-01`);
  const out: Bill[] = [];
  for (const r of recurrences) {
    if (r.type !== "despesa" || !r.active || !isBillFrequency(r)) continue;
    for (const dueDate of occurrencesUpTo({ ...r, lastGeneratedDate: undefined }, monthEnd)) {
      if (monthKey(dueDate) !== key) continue;
      const paid = (r.paidDates ?? []).includes(dueDate);
      const status: BillStatus = paid ? "paga" : dueDate < today ? "atrasada" : dueDate === today ? "hoje" : "pendente";
      out.push({ key: `${r.id}:${dueDate}`, recurrence: r, dueDate, paid, status });
    }
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.recurrence.description.localeCompare(b.recurrence.description, "pt-BR"));
}

export interface BillsView {
  currentKey: string;
  nextKey: string;
  current: Bill[];
  next: Bill[];
  /** O mês atual só aparece enquanto falta pagar alguma conta; com tudo pago, a lista segue para o mês seguinte. */
  showCurrent: boolean;
  /** Contas do mês atual (vazio = nenhuma conta com vencimento neste mês). */
  currentPaidAll: boolean;
  pendingCents: number;
  pendingCount: number;
  overdueCount: number;
}

export function buildBillsView(recurrences: Recurrence[], today: string): BillsView {
  const currentKey = monthKey(today);
  const nextKey = monthKey(addMonths(startOfMonth(today), 1));
  const current = billsInMonth(recurrences, currentKey, today);
  const next = billsInMonth(recurrences, nextKey, today);
  const unpaid = current.filter((b) => !b.paid);
  return {
    currentKey, nextKey, current, next,
    showCurrent: unpaid.length > 0,
    currentPaidAll: current.length > 0 && unpaid.length === 0,
    pendingCents: unpaid.reduce((s, b) => s + b.recurrence.amountCents, 0),
    pendingCount: unpaid.length,
    overdueCount: unpaid.filter((b) => b.status === "atrasada").length,
  };
}

/** Lembretes: contas atrasadas (deste mês) e as que vencem nos próximos `days` dias (inclui hoje). */
export function reminderBills(recurrences: Recurrence[], today: string, days = 3): { overdue: Bill[]; soon: Bill[] } {
  const view = buildBillsView(recurrences, today);
  const limit = addDays(today, days);
  const all = [...view.current, ...view.next].filter((b) => !b.paid);
  return {
    overdue: all.filter((b) => b.status === "atrasada"),
    soon: all.filter((b) => b.dueDate >= today && b.dueDate <= limit),
  };
}
