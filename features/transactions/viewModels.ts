import type { Account, Card, Category, Transaction as DomainTransaction } from "@/types/domain";
import type { Transaction as TransactionItemData } from "@/types/finance";

export interface Lookups {
  categories: Category[];
  accounts: Account[];
  cards: Card[];
}

const FALLBACK = { category: "Sem categoria", account: "Conta removida", card: "Cartão removido" };

/** Nome legível de cada vínculo (contas e cartões arquivados continuam com nome). */
export function makeNamers({ categories, accounts, cards }: Lookups) {
  const cat = new Map(categories.map((c) => [c.id, c.name]));
  const acc = new Map(accounts.map((a) => [a.id, a.name]));
  const card = new Map(cards.map((c) => [c.id, c.name]));
  const color = new Map(categories.map((c) => [c.id, c.color]));
  return {
    categoryColor: (id?: string) => (id ? color.get(id) : undefined),
    category: (id?: string) => (id && cat.get(id)) || FALLBACK.category,
    account: (id?: string) => (id && acc.get(id)) || FALLBACK.account,
    card: (id?: string) => (id && card.get(id)) || FALLBACK.card,
  };
}

/** Texto curto de contexto: "Parcela 2/6", "Recorrente". */
export function transactionNote(t: DomainTransaction): string | undefined {
  const parts: string[] = [];
  if (t.installmentNumber && t.installmentTotal) parts.push(`Parcela ${t.installmentNumber}/${t.installmentTotal}`);
  if (t.recurrenceId) parts.push("Recorrente");
  return parts.length ? parts.join(" · ") : undefined;
}

/** Transações do domínio -> linhas da lista (valor em reais só na borda da tela). */
export function toTransactionItems(txs: DomainTransaction[], lookups: Lookups, today?: string): TransactionItemData[] {
  const n = makeNamers(lookups);
  return txs.map((t) => {
    const base = { id: t.id, description: t.description, amount: t.amountCents / 100, date: t.date, note: [today && t.date > today ? "Agendada" : undefined, transactionNote(t)].filter(Boolean).join(" · ") || undefined, categoryColor: n.categoryColor(t.categoryId) };
    switch (t.type) {
      case "receita":
        return { ...base, type: "receita" as const, category: n.category(t.categoryId), account: n.account(t.accountId) };
      case "despesa":
        return t.cardId
          ? { ...base, type: "despesa" as const, category: n.category(t.categoryId), account: n.card(t.cardId), card: n.card(t.cardId) }
          : { ...base, type: "despesa" as const, category: n.category(t.categoryId), account: n.account(t.accountId) };
      case "transferencia":
        return { ...base, type: "transferencia" as const, category: "Transferência", account: `${n.account(t.accountId)} → ${n.account(t.toAccountId)}` };
      case "pagamento_fatura":
        // sai da conta, então aparece como saída; não é "despesa" nos totais (isso é decidido no domínio)
        return { ...base, type: "despesa" as const, category: "Fatura", account: n.account(t.accountId) };
    }
  });
}
