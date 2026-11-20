import { addDays, addMonths, endOfMonth, monthKey, startOfMonth } from "@/lib/date";
import { occurrencesUpTo } from "@/services/recurrences/schedule";
import type { Invoice, Recurrence, Transaction } from "@/types/domain";

export type BillStatus = "paga" | "atrasada" | "hoje" | "pendente";

/**
 * Um vencimento de uma despesa fixa (ex.: o aluguel de 05/11).
 * `onCard`: despesa no cartão. Não se paga uma por uma: fica paga quando a fatura em que caiu é paga.
 */
export interface Bill { key: string; recurrence: Recurrence; dueDate: string; paid: boolean; status: BillStatus; onCard: boolean }

/**
 * Vencimentos de despesas no cartão ("recId:YYYY-MM-DD") cuja fatura já foi paga.
 * Usa o id determinístico do lançamento automático ("rec:<recId>:<data>").
 */
export function cardPaidKeys(transactions: Pick<Transaction, "id" | "cardId" | "invoiceId">[], invoices: Pick<Invoice, "id" | "paidAt">[]): Set<string> {
  const paidInvoices = new Set(invoices.filter((i) => i.paidAt).map((i) => i.id));
  const out = new Set<string>();
  for (const t of transactions) {
    if (t.cardId && t.invoiceId && t.id.startsWith("rec:") && paidInvoices.has(t.invoiceId)) out.add(t.id.slice(4));
  }
  return out;
}

/** Só mensal e anual viram "conta" com vencimento (diária e semanal não têm um dia no mês). */
const isBillFrequency = (r: Recurrence) => r.frequency === "mensal" || r.frequency === "anual";

/** Vencimentos das despesas fixas ativas dentro do mês `key` ("YYYY-MM"), por data. */
export function billsInMonth(recurrences: Recurrence[], key: string, today: string, cardPaid?: Set<string>): Bill[] {
  const monthEnd = endOfMonth(`${key}-01`);
  const out: Bill[] = [];
  for (const r of recurrences) {
    if (r.type !== "despesa" || !r.active || !isBillFrequency(r)) continue;
    for (const dueDate of occurrencesUpTo({ ...r, lastGeneratedDate: undefined }, monthEnd)) {
      if (monthKey(dueDate) !== key) continue;
      const billKey = `${r.id}:${dueDate}`;
      const onCard = !!r.cardId;
      const paid = onCard ? !!cardPaid?.has(billKey) : (r.paidDates ?? []).includes(dueDate);
      // No cartão nunca fica "atrasada": quem atrasa é a fatura (e ela tem o próprio aviso).
      const status: BillStatus = paid ? "paga" : onCard ? "pendente" : dueDate < today ? "atrasada" : dueDate === today ? "hoje" : "pendente";
      out.push({ key: billKey, recurrence: r, dueDate, paid, status, onCard });
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
  /** Despesas no cartão do mês atual cuja fatura ainda não foi paga. */
  cardPendingCount: number;
  pendingCents: number;
  pendingCount: number;
  overdueCount: number;
}

/** Totais e contagens "falta pagar" só olham as contas de conta bancária: as do cartão entram na fatura. */
export function buildBillsView(recurrences: Recurrence[], today: string, cardPaid?: Set<string>): BillsView {
  const currentKey = monthKey(today);
  const nextKey = monthKey(addMonths(startOfMonth(today), 1));
  const current = billsInMonth(recurrences, currentKey, today, cardPaid);
  const next = billsInMonth(recurrences, nextKey, today, cardPaid);
  const unpaid = current.filter((b) => !b.paid && !b.onCard);
  const cardPending = current.filter((b) => !b.paid && b.onCard);
  return {
    currentKey, nextKey, current, next,
    showCurrent: unpaid.length > 0 || cardPending.length > 0,
    currentPaidAll: current.length > 0 && unpaid.length === 0 && cardPending.length === 0,
    cardPendingCount: cardPending.length,
    pendingCents: unpaid.reduce((s, b) => s + b.recurrence.amountCents, 0),
    pendingCount: unpaid.length,
    overdueCount: unpaid.filter((b) => b.status === "atrasada").length,
  };
}

/** Lembretes: contas atrasadas (deste mês) e as que vencem nos próximos `days` dias (inclui hoje). */
export function reminderBills(recurrences: Recurrence[], today: string, days = 3): { overdue: Bill[]; soon: Bill[] } {
  const view = buildBillsView(recurrences, today);
  const limit = addDays(today, days);
  const all = [...view.current, ...view.next].filter((b) => !b.paid && !b.onCard); // cartão: o aviso é o da fatura
  return {
    overdue: all.filter((b) => b.status === "atrasada"),
    soon: all.filter((b) => b.dueDate >= today && b.dueDate <= limit),
  };
}
