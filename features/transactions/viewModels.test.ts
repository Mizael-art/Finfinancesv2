import { describe, expect, it } from "vitest";
import type { Account, Card, Category, Transaction } from "@/types/domain";
import { PERIODS, rangeFor } from "./periods";
import { toTransactionItems, transactionNote } from "./viewModels";

const stamp = { createdAt: "", updatedAt: "" };
const lookups = {
  categories: [{ id: "c1", name: "Alimentação", kind: "despesa", isDefault: true, ...stamp }, { id: "c2", name: "Salário", kind: "receita", isDefault: true, ...stamp }] as Category[],
  accounts: [{ id: "a1", name: "Nubank", type: "digital", initialBalanceCents: 0, ...stamp }, { id: "a2", name: "Inter", type: "digital", initialBalanceCents: 0, archivedAt: "x", ...stamp }] as Account[],
  cards: [{ id: "k1", name: "Nu Roxinho", institution: "Nubank", limitCents: 1, closingDay: 1, dueDay: 8, ...stamp }] as Card[],
};
const tx = (over: Partial<Transaction>): Transaction => ({ id: "t", type: "despesa", amountCents: 12345, description: "x", date: "2026-09-10", ...stamp, ...over });

describe("toTransactionItems", () => {
  it("receita e despesa: nomes e valor em reais", () => {
    const [r, d] = toTransactionItems([tx({ type: "receita", accountId: "a1", categoryId: "c2", amountCents: 500000 }), tx({ accountId: "a1", categoryId: "c1" })], lookups);
    expect(r).toMatchObject({ type: "receita", category: "Salário", account: "Nubank", amount: 5000 });
    expect(d).toMatchObject({ type: "despesa", category: "Alimentação", account: "Nubank", amount: 123.45 });
  });

  it("transferência mostra origem → destino (inclusive conta arquivada)", () => {
    const [t] = toTransactionItems([tx({ type: "transferencia", accountId: "a1", toAccountId: "a2" })], lookups);
    expect(t).toMatchObject({ type: "transferencia", category: "Transferência", account: "Nubank → Inter" });
  });

  it("compra no cartão mostra o cartão no lugar da conta", () => {
    const [t] = toTransactionItems([tx({ cardId: "k1", categoryId: "c1" })], lookups);
    expect(t).toMatchObject({ account: "Nu Roxinho", card: "Nu Roxinho" });
  });

  it("pagamento de fatura aparece como saída da conta, categoria 'Fatura'", () => {
    const [t] = toTransactionItems([tx({ type: "pagamento_fatura", accountId: "a1", invoiceId: "i" })], lookups);
    expect(t).toMatchObject({ type: "despesa", category: "Fatura", account: "Nubank" });
  });

  it("vínculos que sumiram não quebram a tela", () => {
    const [t] = toTransactionItems([tx({ accountId: "fantasma", categoryId: "fantasma" })], lookups);
    expect(t).toMatchObject({ category: "Sem categoria", account: "Conta removida" });
  });

  it("notas de parcela e repetição", () => {
    expect(transactionNote(tx({ installmentNumber: 2, installmentTotal: 6 }))).toBe("Parcela 2/6");
    expect(transactionNote(tx({ recurrenceId: "r" }))).toBe("Recorrente");
    expect(transactionNote(tx({ installmentNumber: 1, installmentTotal: 3, recurrenceId: "r" }))).toBe("Parcela 1/3 · Recorrente");
    expect(transactionNote(tx({}))).toBeUndefined();
  });
});

describe("períodos", () => {
  const today = "2026-09-29";
  it("intervalos de calendário", () => {
    expect(rangeFor("mes", today)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(rangeFor("mes_passado", today)).toEqual({ from: "2026-08-01", to: "2026-08-31" });
    expect(rangeFor("tres_meses", today)).toEqual({ from: "2026-07-01", to: "2026-09-30" });
    expect(rangeFor("ano", today)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(rangeFor("tudo", today)).toEqual({});
  });
  it("mês passado na virada de ano e em março (fevereiro curto)", () => {
    expect(rangeFor("mes_passado", "2027-01-15")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(rangeFor("mes_passado", "2026-03-31")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(rangeFor("tres_meses", "2027-02-10")).toEqual({ from: "2026-12-01", to: "2027-02-28" });
  });
  it("todo período tem rótulo", () => expect(PERIODS.every((p) => p.label && p.short)).toBe(true));
});
