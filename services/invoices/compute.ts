import type { Card, Invoice, InvoiceStatus, Transaction } from "@/types/domain";
import { getInvoiceStatus } from "./status";

/** Compras de cartão (despesa com cardId) de uma fatura. */
export const purchasesOf = (txs: Transaction[], invoiceId: string) => txs.filter((t) => t.type === "despesa" && t.cardId && t.invoiceId === invoiceId);

export function computeInvoiceTotals(txs: Transaction[]): Map<string, { totalCents: number; count: number }> {
  const out = new Map<string, { totalCents: number; count: number }>();
  for (const t of txs) {
    if (t.type !== "despesa" || !t.cardId || !t.invoiceId) continue;
    const cur = out.get(t.invoiceId) ?? { totalCents: 0, count: 0 };
    cur.totalCents += t.amountCents;
    cur.count += 1;
    out.set(t.invoiceId, cur);
  }
  return out;
}

/**
 * Limite usado = compras no cartão − pagamentos de fatura daquele cartão (derivado das transações).
 * Sem `cardId`, soma todos os cartões. Nunca fica negativo.
 */
export function computeCardUsedCents(txs: Transaction[], invoices: Invoice[], cardId?: string): number {
  const cardOfInvoice = new Map(invoices.map((i) => [i.id, i.cardId]));
  let used = 0;
  for (const t of txs) {
    if (t.type === "despesa" && t.cardId && (!cardId || t.cardId === cardId)) used += t.amountCents;
    else if (t.type === "pagamento_fatura") {
      const owner = t.cardId ?? (t.invoiceId ? cardOfInvoice.get(t.invoiceId) : undefined);
      if (owner && (!cardId || owner === cardId)) used -= t.amountCents;
      else if (!owner && !cardId) used -= t.amountCents;
    }
  }
  return Math.max(0, used);
}

export interface InvoiceView {
  invoice: Invoice;
  cardId: string;
  cardName: string;
  totalCents: number;
  purchaseCount: number;
  status: InvoiceStatus;
  /** Data (YYYY-MM-DD) em que foi paga, quando paga. */
  paidDate?: string;
  paymentAccountId?: string;
}

export function buildInvoiceViews(invoices: Invoice[], txs: Transaction[], cards: Card[], today: string): InvoiceView[] {
  const totals = computeInvoiceTotals(txs);
  const names = new Map(cards.map((c) => [c.id, c.name]));
  const byId = new Map(txs.map((t) => [t.id, t]));
  return invoices
    .map((invoice): InvoiceView => {
      const t = totals.get(invoice.id);
      const payment = invoice.paymentTransactionId ? byId.get(invoice.paymentTransactionId) : undefined;
      return {
        invoice,
        cardId: invoice.cardId,
        cardName: names.get(invoice.cardId) ?? "Cartão removido",
        totalCents: t?.totalCents ?? 0,
        purchaseCount: t?.count ?? 0,
        status: getInvoiceStatus(invoice, today),
        paidDate: invoice.paidAt ? payment?.date ?? invoice.paidAt.slice(0, 10) : undefined,
        paymentAccountId: invoice.paidFromAccountId,
      };
    })
    .sort((a, b) => b.invoice.dueDate.localeCompare(a.invoice.dueDate) || a.cardName.localeCompare(b.cardName));
}
