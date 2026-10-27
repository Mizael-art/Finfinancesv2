import { todayISODate } from "@/lib/date";
import { InUseError, ValidationError } from "@/lib/errors";
import type { Account, NewEntity } from "@/types/domain";
import type { Storage } from "@/storage/types";
import { nowISO } from "@/lib/date";
import { createCrud } from "../shared/crud";
import { compact, optionalText, requireCents, requireOneOf, requireText } from "../shared/validation";
import { computeCardUsedCents } from "../invoices/compute";
import { computeBalanceCents, computeBalanceSeries, computeCashCents, computeNetWorthCents } from "./balance";

const TYPES = ["corrente", "poupanca", "digital", "carteira", "dinheiro", "investimento", "outra"] as const;

export function normalizeAccountShape(data: NewEntity<Account>): NewEntity<Account> {
  return compact({
    ...data,
    name: requireText(data.name, "name", "o nome da conta", 60),
    institution: optionalText(data.institution, "institution", "a instituição", 60),
    type: requireOneOf(data.type, "type", "o tipo da conta", TYPES),
    initialBalanceCents: requireCents(data.initialBalanceCents ?? 0, "initialBalanceCents", "saldo inicial", Number.MIN_SAFE_INTEGER),
  });
}

export interface AccountWithBalance extends Account {
  balanceCents: number;
  series: number[];
}

export function createAccountsService(storage: Storage) {
  const crud = createCrud(storage, "accounts", {
    label: "Conta",
    normalize: async (data, current) => {
      const normalized = normalizeAccountShape(data);
      const clash = (await crud.list()).find((a) => a.id !== current?.id && !a.archivedAt && a.name.trim().toLowerCase() === normalized.name.toLowerCase());
      if (clash) throw new ValidationError("Você já tem uma conta com esse nome.", "name");
      return normalized;
    },
  });

  async function list(opts: { includeArchived?: boolean } = {}): Promise<Account[]> {
    const all = (await crud.list()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return opts.includeArchived ? all : all.filter((a) => !a.archivedAt);
  }

  async function listWithBalances(opts: { includeArchived?: boolean } = {}): Promise<AccountWithBalance[]> {
    const [accounts, txs] = await Promise.all([list(opts), storage.repo("transactions").list()]);
    const today = todayISODate();
    return accounts.map((a) => ({ ...a, balanceCents: computeBalanceCents(a, txs), series: computeBalanceSeries(a, txs, today) }));
  }

  return {
    get: crud.get,
    require: crud.require,
    list,
    listWithBalances,
    create: (input: NewEntity<Account>) => crud.create(input),
    update: crud.update,

    /** "Meu saldo hoje é X": ajusta o saldo INICIAL para o saldo atual virar X, sem tocar nas transações. */
    async setCurrentBalance(id: string, targetCents: number) {
      requireCents(targetCents, "balance", "saldo", Number.MIN_SAFE_INTEGER);
      const account = await crud.require(id);
      const txs = await storage.repo("transactions").list();
      const delta = targetCents - computeBalanceCents(account, txs);
      return crud.update(id, { initialBalanceCents: account.initialBalanceCents + delta });
    },

    async archive(id: string) {
      await crud.require(id);
      return crud.update(id, { archivedAt: nowISO() });
    },
    async restore(id: string) {
      const acc = await crud.require(id);
      const { archivedAt: _a, ...rest } = acc;
      void _a;
      return storage.repo("accounts").put({ ...rest, updatedAt: nowISO() });
    },

    async remove(id: string) {
      await crud.require(id);
      const [asSource, asTarget, recurrences, cards, incomes] = await Promise.all([
        storage.repo("transactions").listBy("accountId", id),
        storage.repo("transactions").listBy("toAccountId", id),
        storage.repo("recurrences").list(),
        storage.repo("cards").list(),
        storage.repo("incomeSources").list(),
      ]);
      const uses = asSource.length + asTarget.length + recurrences.filter((r) => r.accountId === id).length
        + cards.filter((c) => c.defaultPaymentAccountId === id).length + incomes.filter((i) => i.accountId === id).length;
      if (uses > 0) throw new InUseError("Essa conta tem movimentações. Arquive-a para manter o histórico.", uses);
      await crud.remove(id);
    },

    /** Patrimônio = soma dos saldos das contas ativas (transferência não altera). */
    async getNetWorthCents(): Promise<number> {
      const accounts = await listWithBalances();
      return accounts.reduce((s, a) => s + a.balanceCents, 0);
    },

    /** Tudo que o Início e a página Contas precisam, numa leitura. */
    async overview() {
      const [all, txs, invoices] = await Promise.all([list({ includeArchived: true }), storage.repo("transactions").list(), storage.repo("invoices").list()]);
      const today = todayISODate();
      const withBalance: AccountWithBalance[] = all.map((a) => ({ ...a, balanceCents: computeBalanceCents(a, txs), series: computeBalanceSeries(a, txs, today) }));
      const active = withBalance.filter((a) => !a.archivedAt);
      const balances = new Map(active.map((a) => [a.id, a.balanceCents]));
      return {
        accounts: active,
        archived: withBalance.filter((a) => a.archivedAt),
        netWorthCents: computeNetWorthCents(active, balances),
        cashCents: computeCashCents(active, balances),
        cardUsedCents: computeCardUsedCents(txs, invoices),
      };
    },
  };
}
export type AccountsService = ReturnType<typeof createAccountsService>;
