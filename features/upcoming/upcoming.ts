import { billsInMonth } from "@/features/bills/bills";
import { addMonths, endOfMonth, monthKey, startOfMonth } from "@/lib/date";
import type { InvoiceView } from "@/services/invoices/compute";
import type { Recurrence } from "@/types/domain";

/** Algo que ainda vai sair do seu bolso: uma conta fixa ou a fatura de um cartão. */
export interface UpcomingItem {
  id: string;
  kind: "conta" | "fatura";
  title: string;
  /** Vencimento (YYYY-MM-DD). */
  dueDate: string;
  cents: number;
  status: "atrasada" | "hoje" | "proxima";
  /** Texto curto extra (ex.: "Fatura fechada"). */
  detail?: string;
  href: string;
}

export interface UpcomingInput {
  today: string;
  recurrences: Recurrence[];
  invoices: InvoiceView[];
  /** Quantos meses olhar, contando o atual (padrão 3). */
  months?: number;
}

const INVOICE_DETAIL: Record<string, string> = { aberta: "Fatura em aberto", fechada: "Fatura fechada", atrasada: "Fatura atrasada" };

/**
 * Contas fixas ainda não pagas e faturas de cartão ainda não pagas, ordenadas pelo vencimento.
 * Faturas e contas com vencimento depois do período olhado ficam de fora.
 */
export function buildUpcoming({ today, recurrences, invoices, months = 3 }: UpcomingInput): UpcomingItem[] {
  const horizon = endOfMonth(addMonths(startOfMonth(today), months - 1));
  const out: UpcomingItem[] = [];

  for (let i = 0; i < months; i++) {
    const key = monthKey(addMonths(startOfMonth(today), i));
    for (const b of billsInMonth(recurrences, key, today)) {
      if (b.paid) continue;
      out.push({
        id: `conta:${b.key}`, kind: "conta", title: b.recurrence.description, dueDate: b.dueDate, cents: b.recurrence.amountCents,
        status: b.status === "atrasada" ? "atrasada" : b.status === "hoje" ? "hoje" : "proxima", href: "/fixas",
      });
    }
  }

  for (const v of invoices) {
    if (v.status === "paga" || v.totalCents <= 0 || v.invoice.dueDate > horizon) continue;
    const due = v.invoice.dueDate;
    out.push({
      id: `fatura:${v.invoice.id}`, kind: "fatura", title: `Fatura ${v.cardName}`, dueDate: due, cents: v.totalCents,
      status: v.status === "atrasada" || due < today ? "atrasada" : due === today ? "hoje" : "proxima",
      detail: INVOICE_DETAIL[v.status], href: "/faturas",
    });
  }

  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (a.kind === b.kind ? a.title.localeCompare(b.title, "pt-BR") : a.kind === "conta" ? -1 : 1));
}
