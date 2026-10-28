import { addDays } from "@/lib/date";
import type { Account, Transaction } from "@/types/domain";

/**
 * Efeito de UMA transação no saldo da conta `accountId` (em centavos, com sinal).
 * - receita: entra. despesa: sai da conta, mas despesa de CARTÃO nunca mexe na conta
 *   (nem se um backup importado vier com conta E cartão).
 * - transferência: sai da origem e entra no destino. Pagamento de fatura: sai da conta.
 */
export function effectOnAccount(t: Transaction, accountId: string): number {
  switch (t.type) {
    case "receita":
      return t.accountId === accountId ? t.amountCents : 0;
    case "despesa":
      if (t.cardId) return 0;
      return t.accountId === accountId ? -t.amountCents : 0;
    case "transferencia":
      return (t.accountId === accountId ? -t.amountCents : 0) + (t.toAccountId === accountId ? t.amountCents : 0);
    case "pagamento_fatura":
      return t.accountId === accountId ? -t.amountCents : 0;
  }
}

/**
 * Saldo = saldo inicial + efeito das transações (derivado, nunca gravado). Com `upTo` (use a data de hoje), lançamentos
 * futuros/agendados não entram: o dinheiro só sai ou entra no dia.
 */
export function computeBalanceCents(account: Pick<Account, "id" | "initialBalanceCents">, txs: Transaction[], upTo?: string): number {
  let total = account.initialBalanceCents;
  for (const t of txs) {
    if (upTo && t.date > upTo) continue;
    total += effectOnAccount(t, account.id);
  }
  return total;
}

/** Saldo ao fim de cada um dos últimos `days` dias (para o mini-gráfico), do mais antigo ao mais novo. */
export function computeBalanceSeries(account: Pick<Account, "id" | "initialBalanceCents">, txs: Transaction[], today: string, days = 15): number[] {
  return Array.from({ length: days }, (_, i) => computeBalanceCents(account, txs, addDays(today, i - (days - 1))));
}

export const CASH_TYPES = ["carteira", "dinheiro"] as const;

export function computeCashCents(accounts: Account[], balances: Map<string, number>): number {
  return accounts.filter((a) => (CASH_TYPES as readonly string[]).includes(a.type)).reduce((s, a) => s + (balances.get(a.id) ?? 0), 0);
}

export function computeNetWorthCents(accounts: Account[], balances: Map<string, number>): number {
  return accounts.reduce((s, a) => s + (balances.get(a.id) ?? 0), 0);
}
