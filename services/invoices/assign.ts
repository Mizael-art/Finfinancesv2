import { formatMonthLabel } from "@/lib/date";
import { ValidationError } from "@/lib/errors";
import { nowISO } from "@/lib/date";
import type { Card, Invoice } from "@/types/domain";
import type { BatchOp, Storage } from "@/storage/types";
import { invoiceCycle, invoiceIdFor } from "./cycle";

/**
 * Descobre (ou prepara) a fatura de cada compra. Faturas novas viram operações em `ops`,
 * gravadas junto com a transação no mesmo `batch` (tudo ou nada).
 */
export function createInvoiceResolver(storage: Storage) {
  const known = new Map<string, Invoice>();
  const ops: BatchOp[] = [];

  async function resolve(card: Card, purchaseDate: string, offsetMonths = 0): Promise<Invoice> {
    const cycle = invoiceCycle(card, purchaseDate, offsetMonths);
    const id = invoiceIdFor(card.id, cycle.referenceKey);
    let invoice = known.get(id) ?? (await storage.repo("invoices").get(id));
    if (invoice?.paidAt) {
      throw new ValidationError(`A fatura de ${formatMonthLabel(cycle.referenceKey)} do cartão ${card.name} já foi paga. Escolha uma data em outra fatura.`, "date");
    }
    if (!invoice) {
      const now = nowISO();
      invoice = { id, cardId: card.id, referenceKey: cycle.referenceKey, closingDate: cycle.closingDate, dueDate: cycle.dueDate, createdAt: now, updatedAt: now };
      ops.push({ store: "invoices", type: "put", value: invoice });
    }
    known.set(id, invoice);
    return invoice;
  }
  return { resolve, ops };
}
export type InvoiceResolver = ReturnType<typeof createInvoiceResolver>;

/** Faturas (não pagas) que ficariam sem nenhuma compra depois de remover `leaving` — viram operações de exclusão. */
export async function pruneEmptyInvoices(storage: Storage, invoiceIds: Iterable<string>, leaving: Set<string>): Promise<BatchOp[]> {
  const ops: BatchOp[] = [];
  for (const id of new Set(invoiceIds)) {
    const invoice = await storage.repo("invoices").get(id);
    if (!invoice || invoice.paidAt) continue;
    const remaining = (await storage.repo("transactions").listBy("invoiceId", id)).filter((t) => !leaving.has(t.id));
    if (remaining.length === 0) ops.push({ store: "invoices", type: "delete", id });
  }
  return ops;
}
