import { todayISODate } from "@/lib/date";
import { InUseError, ValidationError } from "@/lib/errors";
import type { Card, Invoice, NewEntity } from "@/types/domain";
import type { Storage } from "@/storage/types";
import { nowISO } from "@/lib/date";
import { createCrud } from "../shared/crud";
import { compact, optionalText, requireCents, requireIntInRange, requireText } from "../shared/validation";
import { computeCardUsedCents, computeInvoiceTotals } from "../invoices/compute";
import { invoiceCycle, invoiceIdFor } from "../invoices/cycle";

/** Regras de formato (não consultam o banco). */
export function normalizeCardShape(data: NewEntity<Card>): NewEntity<Card> {
  const last4 = data.last4 === undefined || data.last4 === "" ? undefined : data.last4;
  if (last4 !== undefined && !/^\d{4}$/.test(last4)) throw new ValidationError("Os 4 últimos dígitos precisam ser só números.", "last4");
  return compact({
    ...data,
    name: requireText(data.name, "name", "o nome do cartão", 40),
    institution: requireText(data.institution, "institution", "a instituição", 60),
    issuer: optionalText(data.issuer, "issuer", "o modelo", 30),
    last4,
    limitCents: requireCents(data.limitCents, "limitCents", "limite", 0),
    closingDay: requireIntInRange(data.closingDay, "closingDay", "o dia de fechamento", 1, 31),
    dueDay: requireIntInRange(data.dueDay, "dueDay", "o dia de vencimento", 1, 31),
    defaultPaymentAccountId: data.defaultPaymentAccountId || undefined,
  });
}

export interface CardView extends Card {
  usedCents: number;
  availableCents: number;
  overLimit: boolean;
  /** Fatura em que cai uma compra de hoje (pode ainda não existir no banco, se não há compras). */
  nextInvoice: { referenceKey: string; closingDate: string; dueDate: string; totalCents: number; invoiceId: string };
}

export function createCardsService(storage: Storage) {
  const crud = createCrud(storage, "cards", {
    label: "Cartão",
    normalize: async (data) => {
      const normalized = normalizeCardShape(data);
      if (normalized.defaultPaymentAccountId && !(await storage.repo("accounts").get(normalized.defaultPaymentAccountId))) {
        throw new ValidationError("A conta de pagamento escolhida não existe.", "defaultPaymentAccountId");
      }
      return normalized;
    },
  });

  async function list(opts: { includeArchived?: boolean } = {}): Promise<Card[]> {
    const all = (await crud.list()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return opts.includeArchived ? all : all.filter((c) => !c.archivedAt);
  }

  return {
    get: crud.get,
    require: crud.require,
    list,
    create: (input: NewEntity<Card>) => crud.create(input),
    update: crud.update,
    async archive(id: string) { await crud.require(id); return crud.update(id, { archivedAt: nowISO() }); },
    async restore(id: string) {
      const card = await crud.require(id);
      const { archivedAt: _a, ...rest } = card;
      void _a;
      return storage.repo("cards").put({ ...rest, updatedAt: nowISO() });
    },

    /** Exclusão só de cartão sem histórico; com compras/faturas, arquive. */
    async remove(id: string) {
      await crud.require(id);
      const [txs, invoices, recurrences] = await Promise.all([
        storage.repo("transactions").listBy("cardId", id),
        storage.repo("invoices").listBy("cardId", id),
        storage.repo("recurrences").list(),
      ]);
      const uses = txs.length + invoices.length + recurrences.filter((r) => r.cardId === id).length;
      if (uses > 0) throw new InUseError("Esse cartão tem compras ou faturas. Arquive-o para manter o histórico.", uses);
      await crud.remove(id);
    },

    /** Cartões com limite usado/disponível e a fatura atual, numa leitura. */
    async overview(opts: { includeArchived?: boolean; today?: string } = {}): Promise<CardView[]> {
      const today = opts.today ?? todayISODate();
      const [cards, txs, invoices] = await Promise.all([list(opts), storage.repo("transactions").list(), storage.repo("invoices").list()]);
      const totals = computeInvoiceTotals(txs);
      return cards.map((card): CardView => {
        const usedCents = computeCardUsedCents(txs, invoices as Invoice[], card.id);
        const cycle = invoiceCycle(card, today);
        const invoiceId = invoiceIdFor(card.id, cycle.referenceKey);
        return {
          ...card,
          usedCents,
          availableCents: Math.max(0, card.limitCents - usedCents),
          overLimit: usedCents > card.limitCents,
          nextInvoice: { ...cycle, invoiceId, totalCents: totals.get(invoiceId)?.totalCents ?? 0 },
        };
      });
    },
  };
}
export type CardsService = ReturnType<typeof createCardsService>;
