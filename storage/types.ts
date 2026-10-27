import type {
  Account, Budget, Card, Category, Goal, IncomeSource, Investment, Invoice, Recurrence, Settings, Transaction, User,
} from "@/types/domain";

/** Stores do banco e o tipo guardado em cada uma. */
export interface StoreMap {
  users: User;
  settings: Settings;
  accounts: Account;
  transactions: Transaction;
  cards: Card;
  invoices: Invoice;
  categories: Category;
  budgets: Budget;
  goals: Goal;
  incomeSources: IncomeSource;
  recurrences: Recurrence;
  investments: Investment;
}
export type StoreName = keyof StoreMap;

export interface Repository<T extends { id: string }> {
  get(id: string): Promise<T | undefined>;
  list(): Promise<T[]>;
  /** Registros cujo índice `index` vale `value`. */
  listBy(index: string, value: string | number): Promise<T[]>;
  count(): Promise<number>;
  put(value: T): Promise<T>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

export type BatchOp = {
  [K in StoreName]:
    | { store: K; type: "put"; value: StoreMap[K] }
    | { store: K; type: "delete"; id: string };
}[StoreName];

export interface ChangeEvent {
  stores: StoreName[];
}

/**
 * Contrato do armazenamento. Hoje: IndexedDB. Amanhã: um adaptador Supabase implementa
 * o mesmo contrato e `storage/index.ts` devolve ele — services e UI não mudam.
 */
export interface Storage {
  repo<K extends StoreName>(name: K): Repository<StoreMap[K]>;
  /** Várias gravações numa única transação: ou grava tudo, ou nada. */
  batch(ops: BatchOp[]): Promise<void>;
  subscribe(listener: (event: ChangeEvent) => void): () => void;
  clearAll(): Promise<void>;
  close(): void;
}
