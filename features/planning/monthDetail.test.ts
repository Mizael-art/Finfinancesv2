import { describe, expect, it } from "vitest";
import { categoryBreakdown, pendingCardDebtByMonth, projectBalances } from "./monthDetail";
import type { PlanMonth } from "./projection";

const month = (o: Partial<PlanMonth>): PlanMonth => ({
  key: "2026-12", items: [], variableCents: 0, incomeCents: 0, expenseCents: 0, balanceCents: 0,
  byGroup: { fixa: 0, parcela: 0, lancada: 0, renda: 0 }, ...o,
});
const cats = [{ id: "mor", name: "Moradia", color: "#f00" }, { id: "ass", name: "Assinaturas" }];

describe("categoryBreakdown", () => {
  it("soma por categoria, ignora receitas, junta sem categoria e põe a estimativa como fatia", () => {
    const m = month({
      variableCents: 50000,
      items: [
        { id: "a", group: "fixa", label: "Aluguel", date: "2026-12-05", cents: 150000, categoryId: "mor" },
        { id: "b", group: "fixa", label: "Netflix", date: "2026-12-10", cents: 4000, categoryId: "ass" },
        { id: "c", group: "parcela", label: "Spotify", date: "2026-12-12", cents: 2000, categoryId: "ass" },
        { id: "d", group: "lancada", label: "Algo", date: "2026-12-15", cents: 3000 },
        { id: "e", group: "lancada", label: "Apagada", date: "2026-12-16", cents: 1000, categoryId: "nao-existe" },
        { id: "f", group: "renda", label: "Salário", date: "2026-12-05", cents: 500000 },
      ],
    });
    const out = categoryBreakdown(m, cats);
    expect(out.map((s) => [s.id, s.cents])).toEqual([["mor", 150000], ["dia-a-dia", 50000], ["ass", 6000], ["sem-categoria", 4000]]);
    expect(out[0]).toMatchObject({ name: "Moradia", color: "#f00", percent: 71 });
    expect(out[1]).toMatchObject({ estimate: true });
  });
  it("mês sem despesas: lista vazia", () => {
    expect(categoryBreakdown(month({}), cats)).toEqual([]);
  });
});

describe("pendingCardDebtByMonth", () => {
  it("só compras já feitas, em faturas não pagas, pelo mês de vencimento", () => {
    const invoices = [{ id: "dez", dueDate: "2026-12-10" }, { id: "nov", dueDate: "2026-11-10", paidAt: "x" }];
    const txs = [
      { type: "despesa" as const, cardId: "c", invoiceId: "dez", date: "2026-11-20", amountCents: 1000 },
      { type: "despesa" as const, cardId: "c", invoiceId: "dez", date: "2026-11-25", amountCents: 500 }, // futura: já está no plano
      { type: "despesa" as const, cardId: "c", invoiceId: "nov", date: "2026-10-20", amountCents: 9999 }, // fatura paga
      { type: "despesa" as const, accountId: "a", date: "2026-11-20", amountCents: 7777 }, // não é cartão
    ];
    expect([...pendingCardDebtByMonth(txs, invoices, "2026-11-22")]).toEqual([["2026-12", 1000]]);
  });
});

describe("projectBalances", () => {
  it("acumula a sobra e tira as faturas no mês em que vencem (atrasadas no primeiro mês)", () => {
    const plan = [{ key: "2026-11", balanceCents: 100 }, { key: "2026-12", balanceCents: -300 }, { key: "2027-01", balanceCents: 200 }];
    const debt = new Map([["2026-10", 50], ["2026-12", 400]]);
    expect(projectBalances(1000, plan, debt)).toEqual([
      { key: "2026-11", startCents: 1000, cardDebtCents: 50, endCents: 1050 },
      { key: "2026-12", startCents: 1050, cardDebtCents: 400, endCents: 350 },
      { key: "2027-01", startCents: 350, cardDebtCents: 0, endCents: 550 },
    ]);
  });
});
