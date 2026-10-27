import type { StoreName } from "./types";

export const DB_NAME = "FinFinanceDB";
export const DB_VERSION = 1;

/** Índices por store (nome do índice = nome do campo). */
export const INDEXES: Record<StoreName, string[]> = {
  users: [],
  settings: [],
  accounts: ["archivedAt"],
  transactions: ["date", "type", "accountId", "toAccountId", "cardId", "invoiceId", "categoryId", "recurrenceId", "installmentGroupId"],
  cards: [],
  invoices: ["cardId", "referenceKey"],
  categories: ["kind"],
  budgets: ["categoryId"],
  goals: [],
  incomeSources: [],
  recurrences: [],
  investments: [],
};

export const STORE_NAMES = Object.keys(INDEXES) as StoreName[];
