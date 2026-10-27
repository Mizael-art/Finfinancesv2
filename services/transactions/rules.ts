import { ValidationError } from "@/lib/errors";
import type { NewEntity, Transaction, TransactionType } from "@/types/domain";
import { compact, fold, optionalText, requireCents, requireDate, requireOneOf, requireText } from "../shared/validation";

export const TRANSACTION_TYPES = ["receita", "despesa", "transferencia", "pagamento_fatura"] as const;

/** Regras de formato (não consultam o banco). */
export function normalizeTransaction(data: NewEntity<Transaction>): NewEntity<Transaction> {
  const type = requireOneOf(data.type, "type", "o tipo", TRANSACTION_TYPES);
  const amountCents = requireCents(data.amountCents, "amountCents", "valor", 1);
  const date = requireDate(data.date, "date", "a data");
  const description = type === "transferencia" ? (data.description ?? "").trim().slice(0, 120) : requireText(data.description, "description", "a descrição", 120);
  const notes = optionalText(data.notes, "notes", "a observação", 500);

  const common = {
    type, amountCents, date, description, notes,
    recurrenceId: data.recurrenceId,
    installmentGroupId: data.installmentGroupId,
    installmentNumber: data.installmentNumber,
    installmentTotal: data.installmentTotal,
  };

  switch (type) {
    case "receita":
      if (!data.accountId) throw new ValidationError("Escolha a conta que recebe.", "accountId");
      return compact({ ...common, accountId: data.accountId, categoryId: data.categoryId });
    case "despesa": {
      if (data.accountId && data.cardId) throw new ValidationError("Escolha a conta OU o cartão, não os dois.", "cardId");
      if (!data.accountId && !data.cardId) throw new ValidationError("Escolha a conta ou o cartão da despesa.", "accountId");
      return compact({ ...common, accountId: data.accountId, cardId: data.cardId, invoiceId: data.cardId ? data.invoiceId : undefined, categoryId: data.categoryId });
    }
    case "transferencia": {
      if (!data.accountId || !data.toAccountId) throw new ValidationError("Escolha a conta de origem e a de destino.", "toAccountId");
      if (data.accountId === data.toAccountId) throw new ValidationError("Escolha contas diferentes.", "toAccountId");
      return compact({ ...common, accountId: data.accountId, toAccountId: data.toAccountId });
    }
    case "pagamento_fatura":
      if (!data.accountId) throw new ValidationError("Escolha a conta que paga a fatura.", "accountId");
      if (!data.invoiceId) throw new ValidationError("Informe a fatura paga.", "invoiceId");
      return compact({ ...common, accountId: data.accountId, invoiceId: data.invoiceId, cardId: data.cardId });
  }
}

export interface TransactionFilter {
  from?: string;
  to?: string;
  type?: TransactionType;
  /** Casa pela conta de origem OU de destino. */
  accountId?: string;
  cardId?: string;
  categoryId?: string;
  invoiceId?: string;
  search?: string;
}

export function filterTransactions(list: Transaction[], f: TransactionFilter = {}): Transaction[] {
  const q = f.search ? fold(f.search) : "";
  return list.filter((t) => {
    if (f.from && t.date < f.from) return false;
    if (f.to && t.date > f.to) return false;
    if (f.type && t.type !== f.type) return false;
    if (f.accountId && t.accountId !== f.accountId && t.toAccountId !== f.accountId) return false;
    if (f.cardId && t.cardId !== f.cardId) return false;
    if (f.categoryId && t.categoryId !== f.categoryId) return false;
    if (f.invoiceId && t.invoiceId !== f.invoiceId) return false;
    if (q && !fold(`${t.description} ${t.notes ?? ""}`).includes(q)) return false;
    return true;
  });
}

export function sortNewestFirst(list: Transaction[]): Transaction[] {
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export interface TransactionSummary {
  incomeCents: number;
  expenseCents: number;
  resultCents: number;
}

/** Só receita e despesa entram. Transferência e pagamento de fatura não (a compra já foi contada). */
export function summarizeTransactions(list: Transaction[]): TransactionSummary {
  let incomeCents = 0;
  let expenseCents = 0;
  for (const t of list) {
    if (t.type === "receita") incomeCents += t.amountCents;
    else if (t.type === "despesa") expenseCents += t.amountCents;
  }
  return { incomeCents, expenseCents, resultCents: incomeCents - expenseCents };
}
