import { addMonths, nowISO } from "@/lib/date";
import { createInvoiceResolver, pruneEmptyInvoices } from "../invoices/assign";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { newId } from "@/lib/id";
import { splitCents } from "@/lib/money";
import type { NewEntity, Recurrence, RecurrenceFrequency, Transaction } from "@/types/domain";
import type { BatchOp, Storage } from "@/storage/types";
import { normalizeRecurrenceShape } from "../recurrences";
import { nextOccurrence } from "../recurrences/schedule";
import { buildEntity, createCrud } from "../shared/crud";
import {
  filterTransactions, normalizeTransaction, sortNewestFirst, summarizeTransactions,
  type TransactionFilter, type TransactionSummary,
} from "./rules";

export const MAX_INSTALLMENTS = 48;

export function createTransactionsService(storage: Storage) {
  /** Confere que os vínculos existem (e fazem sentido) antes de gravar. */
  async function assertReferences(t: NewEntity<Transaction>) {
    const activeAccount = async (id: string | undefined, field: string) => {
      if (!id) return;
      const acc = await storage.repo("accounts").get(id);
      if (!acc) throw new ValidationError("A conta escolhida não existe mais.", field);
      if (acc.archivedAt) throw new ValidationError("A conta escolhida está arquivada.", field);
    };
    await activeAccount(t.accountId, "accountId");
    await activeAccount(t.toAccountId, "toAccountId");

    if (t.categoryId) {
      const cat = await storage.repo("categories").get(t.categoryId);
      if (!cat) throw new ValidationError("A categoria escolhida não existe mais.", "categoryId");
      if (cat.kind !== t.type) throw new ValidationError(`Essa categoria é de ${cat.kind}, não de ${t.type}.`, "categoryId");
    }
    if (t.cardId) {
      const card = await storage.repo("cards").get(t.cardId);
      if (!card) throw new ValidationError("O cartão escolhido não existe mais.", "cardId");
      if (card.archivedAt) throw new ValidationError("O cartão escolhido está arquivado.", "cardId");
    }
    if (t.invoiceId && !(await storage.repo("invoices").get(t.invoiceId))) {
      throw new ValidationError("A fatura informada não existe.", "invoiceId");
    }
  }

  const crud = createCrud(storage, "transactions", {
    label: "Transação",
    normalize: async (data) => {
      const normalized = normalizeTransaction(data);
      await assertReferences(normalized);
      return normalized;
    },
  });

  /** Pagamentos de fatura só se desfazem pela própria fatura (mantém fatura e conta coerentes). */
  const guardInvoicePayment = async (id: string) => {
    const t = await crud.require(id);
    if (t.type === "pagamento_fatura") {
      throw new ValidationError("Este é o pagamento de uma fatura. Para desfazê-lo, use a fatura correspondente.");
    }
    return t;
  };

  /** Fatura paga é histórico fechado: nada que ela contém pode mudar ou sumir sem desfazer o pagamento. */
  const assertInvoiceOpen = async (invoiceId: string | undefined, what: string) => {
    if (!invoiceId) return;
    const invoice = await storage.repo("invoices").get(invoiceId);
    if (invoice?.paidAt) throw new ValidationError(`Essa compra está em uma fatura já paga. Desfaça o pagamento da fatura antes de ${what}.`);
  };

  /** Campos que mexem em dinheiro/fatura; parcelas e faturas pagas só aceitam mudar o resto. */
  const MONEY_FIELDS = ["amountCents", "date", "cardId", "accountId", "type"] as const;
  const touchesMoney = (patch: Partial<NewEntity<Transaction>>, current: Transaction) =>
    MONEY_FIELDS.some((f) => f in patch && patch[f] !== undefined && patch[f] !== current[f]);

  /** Aplica a fatura certa a uma compra de cartão. Faturas novas entram em `resolver.ops`. */
  async function withInvoice(data: NewEntity<Transaction>, resolver: ReturnType<typeof createInvoiceResolver>, offset = 0, cycleDate?: string): Promise<NewEntity<Transaction>> {
    if (data.type !== "despesa" || !data.cardId) return { ...data, invoiceId: undefined };
    const card = await storage.repo("cards").get(data.cardId);
    if (!card) throw new ValidationError("O cartão escolhido não existe mais.", "cardId");
    const invoice = await resolver.resolve(card, cycleDate ?? data.date, offset);
    return { ...data, invoiceId: invoice.id };
  }

  return {
    get: crud.get,

    async create(input: NewEntity<Transaction>) {
      if (input.type === "pagamento_fatura") throw new ValidationError("O pagamento de fatura é feito pela própria fatura.", "type");
      const normalized = normalizeTransaction({ ...input, invoiceId: undefined });
      await assertReferences(normalized);
      const resolver = createInvoiceResolver(storage);
      const tx = buildEntity<Transaction>(await withInvoice(normalized, resolver));
      await storage.batch([...resolver.ops, { store: "transactions", type: "put", value: tx }]);
      return tx;
    },

    async update(id: string, patch: Partial<NewEntity<Transaction>>) {
      const current = await guardInvoicePayment(id);
      if (current.installmentGroupId && touchesMoney(patch, current)) {
        throw new ValidationError("Parcelas não mudam valor, data, cartão ou tipo. Exclua a compra e lance de novo.");
      }
      if (touchesMoney(patch, current)) await assertInvoiceOpen(current.invoiceId, "alterar essa compra");

      const { id: _i, createdAt, updatedAt: _u, ...base } = current;
      void _i; void _u;
      const normalized = normalizeTransaction({ ...base, ...patch, invoiceId: undefined } as NewEntity<Transaction>);
      await assertReferences(normalized);

      const resolver = createInvoiceResolver(storage);
      let next: NewEntity<Transaction>;
      if (normalized.type === "despesa" && normalized.cardId && current.invoiceId && normalized.cardId === current.cardId && normalized.date === current.date) {
        next = { ...normalized, invoiceId: current.invoiceId }; // nada mudou na fatura (mesmo se o fechamento do cartão mudou depois)
      } else {
        next = await withInvoice(normalized, resolver);
      }
      const tx: Transaction = { ...next, id, createdAt, updatedAt: nowISO() } as Transaction;
      const prune = current.invoiceId && current.invoiceId !== tx.invoiceId ? await pruneEmptyInvoices(storage, [current.invoiceId], new Set([id])) : [];
      await storage.batch([...resolver.ops, { store: "transactions", type: "put", value: tx }, ...prune]);
      return tx;
    },

    async remove(id: string) {
      const t = await guardInvoicePayment(id);
      await assertInvoiceOpen(t.invoiceId, "excluí-la");
      const prune = t.invoiceId ? await pruneEmptyInvoices(storage, [t.invoiceId], new Set([id])) : [];
      await storage.batch([{ store: "transactions", type: "delete", id }, ...prune]);
    },

    /** Lista filtrada, da mais recente para a mais antiga. */
    async list(filter: TransactionFilter = {}): Promise<Transaction[]> {
      return sortNewestFirst(filterTransactions(await crud.list(), filter));
    },

    async recent(limit = 5): Promise<Transaction[]> {
      return (await this.list()).slice(0, limit);
    },

    /** Receitas/despesas de um período (transferência e pagamento de fatura não entram). */
    async summarize(range: { from?: string; to?: string } = {}): Promise<TransactionSummary> {
      return summarizeTransactions(await this.list(range));
    },

    count: () => crud.repo().count(),

    /**
     * Lança a transação E cria a repetição que gera as próximas (receita ou despesa).
     * A 1ª ocorrência é esta; a repetição começa na data seguinte, então nada duplica.
     */
    async createRecurring(input: NewEntity<Transaction>, frequency: RecurrenceFrequency) {
      if (input.type !== "receita" && input.type !== "despesa") throw new ValidationError("Só receitas e despesas podem se repetir.", "recurrence");
      const normalized = normalizeTransaction({ ...input, invoiceId: undefined });
      await assertReferences(normalized);
      const recurrenceId = newId();
      const resolver = createInvoiceResolver(storage);
      const transaction = buildEntity<Transaction>(await withInvoice({ ...normalized, recurrenceId }, resolver));
      const recurrence = buildEntity<Recurrence>(
        normalizeRecurrenceShape({
          type: normalized.type as "receita" | "despesa", description: normalized.description, amountCents: normalized.amountCents,
          categoryId: normalized.categoryId, accountId: normalized.accountId, cardId: normalized.cardId, frequency,
          dayOfMonth: Number(normalized.date.slice(8, 10)), active: true,
          startDate: nextOccurrence(frequency, normalized.date), lastGeneratedDate: normalized.date,
        }),
        recurrenceId,
      );
      await storage.batch([...resolver.ops, { store: "transactions", type: "put", value: transaction }, { store: "recurrences", type: "put", value: recurrence }]);
      return transaction;
    },

    /**
     * Compra parcelada no cartão: N lançamentos de valores que somam exatamente o total
     * (sobra de centavos nas primeiras), um por mês a partir da data da compra.
     * A n-ésima parcela cai na n-ésima fatura do cartão (ver `invoiceCycle`); o limite usa o total.
     */
    async createInstallments(input: NewEntity<Transaction>, count: number): Promise<Transaction[]> {
      if (!Number.isInteger(count) || count < 2 || count > MAX_INSTALLMENTS) {
        throw new ValidationError(`O parcelamento deve ter de 2 a ${MAX_INSTALLMENTS} parcelas.`, "installments");
      }
      if (input.type !== "despesa" || !input.cardId) throw new ValidationError("Só compras no cartão podem ser parceladas.", "installments");
      if (!Number.isInteger(input.amountCents) || input.amountCents < count) {
        throw new ValidationError("O valor é pequeno demais para esse número de parcelas.", "amountCents");
      }
      const groupId = newId();
      const base = normalizeTransaction({ ...input, invoiceId: undefined });
      await assertReferences(base);
      const resolver = createInvoiceResolver(storage);
      const entities: Transaction[] = [];
      // A n-ésima parcela cai na n-ésima fatura a partir da data da compra (a data da parcela só rotula).
      for (const [i, amountCents] of splitCents(input.amountCents, count).entries()) {
        const part = normalizeTransaction({
          ...base, amountCents, date: addMonths(input.date, i),
          installmentGroupId: groupId, installmentNumber: i + 1, installmentTotal: count,
        });
        entities.push(buildEntity<Transaction>(await withInvoice(part, resolver, i, input.date)));
      }
      await storage.batch([...resolver.ops, ...entities.map((value): BatchOp => ({ store: "transactions", type: "put", value }))]);
      return entities;
    },

    /** Exclui todas as parcelas da mesma compra. */
    async removeInstallmentGroup(groupId: string) {
      const parts = await storage.repo("transactions").listBy("installmentGroupId", groupId);
      if (parts.length === 0) throw new NotFoundError("Compra parcelada", groupId);
      for (const p of parts) await assertInvoiceOpen(p.invoiceId, "excluir a compra");
      const prune = await pruneEmptyInvoices(storage, parts.map((p) => p.invoiceId).filter((x): x is string => !!x), new Set(parts.map((p) => p.id)));
      await storage.batch([...parts.map((t): BatchOp => ({ store: "transactions", type: "delete", id: t.id })), ...prune]);
    },

    /** Exclui esta ocorrência e encerra a repetição (as já lançadas permanecem). */
    async removeAndStopRecurrence(id: string) {
      const t = await guardInvoicePayment(id);
      await assertInvoiceOpen(t.invoiceId, "excluí-la");
      const ops: BatchOp[] = [{ store: "transactions", type: "delete", id }, ...(t.invoiceId ? await pruneEmptyInvoices(storage, [t.invoiceId], new Set([id])) : [])];
      const rec = t.recurrenceId ? await storage.repo("recurrences").get(t.recurrenceId) : undefined;
      if (rec) ops.push({ store: "recurrences", type: "put", value: { ...rec, active: false, updatedAt: nowISO() } });
      await storage.batch(ops);
    },

    /** Existe, mas lança NotFoundError se não achar (útil em telas de edição). */
    async require(id: string): Promise<Transaction> {
      const t = await crud.get(id);
      if (!t) throw new NotFoundError("Transação", id);
      return t;
    },
  };
}

export type TransactionsService = ReturnType<typeof createTransactionsService>;
export type { TransactionFilter, TransactionSummary } from "./rules";
