import { nowISO, todayISODate } from "@/lib/date";
import { InUseError, NotFoundError, ValidationError } from "@/lib/errors";
import { formatCents } from "@/lib/money";
import { newId } from "@/lib/id";
import type { Invoice, NewEntity, Transaction } from "@/types/domain";
import type { BatchOp, Storage } from "@/storage/types";
import { computeBalanceCents } from "../accounts/balance";
import { buildEntity, createCrud } from "../shared/crud";
import { requireDate, requireText } from "../shared/validation";
import { createInvoiceResolver } from "./assign";
import { buildInvoiceViews, computeInvoiceTotals, type InvoiceView } from "./compute";
import { getInvoiceStatus } from "./status";

export function createInvoicesService(storage: Storage) {
  const crud = createCrud(storage, "invoices", {
    label: "Fatura",
    normalize: async (data) => {
      const card = await storage.repo("cards").get(data.cardId);
      if (!card) throw new ValidationError("O cartão da fatura não existe.", "cardId");
      requireText(data.referenceKey, "referenceKey", "o mês da fatura", 7);
      const closingDate = requireDate(data.closingDate, "closingDate", "a data de fechamento");
      const dueDate = requireDate(data.dueDate, "dueDate", "a data de vencimento");
      if (dueDate < closingDate) throw new ValidationError("O vencimento não pode ser antes do fechamento.", "dueDate");
      return { ...data, closingDate, dueDate };
    },
  });

  async function views(opts: { cardId?: string; today?: string } = {}): Promise<InvoiceView[]> {
    const [invoices, txs, cards] = await Promise.all([crud.list(), storage.repo("transactions").list(), storage.repo("cards").list()]);
    const all = buildInvoiceViews(invoices, txs, cards, opts.today ?? todayISODate());
    return opts.cardId ? all.filter((v) => v.cardId === opts.cardId) : all;
  }

  async function purchases(invoiceId: string): Promise<Transaction[]> {
    const list = await storage.repo("transactions").listBy("invoiceId", invoiceId);
    return list.filter((t) => t.type === "despesa").sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }

  return {
    list: async () => (await crud.list()).sort((a, b) => b.dueDate.localeCompare(a.dueDate)),
    listByCard: async (cardId: string) => (await storage.repo("invoices").listBy("cardId", cardId)).sort((a, b) => b.dueDate.localeCompare(a.dueDate)),
    get: crud.get,
    require: crud.require,
    create: (input: NewEntity<Invoice>) => crud.create(input),
    views,
    purchases,

    /** Só se exclui fatura vazia (as compras dela dependem dela). */
    async remove(id: string) {
      await crud.require(id);
      const used = await storage.repo("transactions").listBy("invoiceId", id);
      if (used.length > 0) throw new InUseError("Essa fatura tem compras e não pode ser excluída.", used.length);
      await crud.remove(id);
    },

    /**
     * Paga a fatura inteira: grava o pagamento (sai da conta, não é despesa) e marca a fatura como paga,
     * tudo numa só gravação. Libera o limite do cartão porque o uso é derivado das transações.
     */
    async pay(invoiceId: string, opts: { accountId: string; today?: string; date?: string }): Promise<Transaction> {
      const invoice = await crud.require(invoiceId);
      const today = opts.today ?? todayISODate();
      if (invoice.paidAt) throw new ValidationError("Essa fatura já foi paga.");
      if (getInvoiceStatus(invoice, today) === "aberta") {
        throw new ValidationError("A fatura ainda está aberta. Você poderá pagá-la depois do fechamento.");
      }
      const date = opts.date ? requireDate(opts.date, "date", "a data do pagamento") : today;
      const total = computeInvoiceTotals(await storage.repo("transactions").listBy("invoiceId", invoiceId)).get(invoiceId)?.totalCents ?? 0;
      if (total <= 0) throw new ValidationError("Essa fatura não tem valor a pagar.");
      const account = await storage.repo("accounts").get(opts.accountId);
      if (!account) throw new ValidationError("A conta escolhida não existe.", "accountId");
      if (account.archivedAt) throw new ValidationError("A conta escolhida está arquivada.", "accountId");
      const balance = computeBalanceCents(account, await storage.repo("transactions").list(), today);
      if (balance < total) {
        throw new ValidationError(`Saldo insuficiente em ${account.name}: faltam ${formatCents(total - balance)} para pagar ${formatCents(total)}.`, "accountId");
      }
      const card = await storage.repo("cards").get(invoice.cardId);
      const payment = buildEntity<Transaction>({
        type: "pagamento_fatura", amountCents: total, date, accountId: account.id, invoiceId, cardId: invoice.cardId,
        description: `Fatura ${card?.name ?? "do cartão"}`,
      }, newId());
      const stamp = nowISO();
      await storage.batch([
        { store: "transactions", type: "put", value: payment },
        { store: "invoices", type: "put", value: { ...invoice, paidAt: stamp, paidFromAccountId: account.id, paymentTransactionId: payment.id, updatedAt: stamp } },
      ]);
      return payment;
    },

    /** Desfaz o pagamento: remove o lançamento e reabre a fatura; o dinheiro volta para a conta. */
    async undoPayment(invoiceId: string) {
      const invoice = await crud.require(invoiceId);
      if (!invoice.paidAt) throw new ValidationError("Essa fatura não está paga.");
      const { paidAt: _a, paidFromAccountId: _b, paymentTransactionId: _c, ...open } = invoice;
      void _a; void _b; void _c;
      const ops: BatchOp[] = [{ store: "invoices", type: "put", value: { ...open, updatedAt: nowISO() } }];
      if (invoice.paymentTransactionId) ops.push({ store: "transactions", type: "delete", id: invoice.paymentTransactionId });
      await storage.batch(ops);
    },

    /** Liga a uma fatura as compras de cartão que ainda não têm (dados antigos/importados). Idempotente. */
    async assignMissing(): Promise<number> {
      const [txs, cards] = await Promise.all([storage.repo("transactions").list(), storage.repo("cards").list()]);
      const loose = txs.filter((t) => t.type === "despesa" && t.cardId && !t.invoiceId);
      if (loose.length === 0) return 0;
      const resolver = createInvoiceResolver(storage);
      const puts: BatchOp[] = [];
      let linked = 0;
      for (const t of loose) {
        const card = cards.find((c) => c.id === t.cardId);
        if (!card) continue;
        try {
          const invoice = await resolver.resolve(card, t.date);
          puts.push({ store: "transactions", type: "put", value: { ...t, invoiceId: invoice.id, updatedAt: nowISO() } });
          linked++;
        } catch { /* fatura já paga: deixa como está, não reescreve histórico */ }
      }
      await storage.batch([...resolver.ops, ...puts]);
      return linked;
    },
  };
}
export type InvoicesService = ReturnType<typeof createInvoicesService>;
export { NotFoundError };
