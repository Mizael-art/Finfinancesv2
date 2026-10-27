import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newId } from "@/lib/id";
import { createIndexedDbStorage } from "@/storage/indexeddb";
import type { Storage } from "@/storage/types";
import { createServices, type Services } from "../index";
import { percentages, previousRange } from "./compute";

let storage: Storage;
let svc: Services;
beforeEach(() => { storage = createIndexedDbStorage(`rep-${newId()}`); svc = createServices(storage); });
afterEach(() => storage.close());
const reais = (n: number) => Math.round(n * 100);

async function setup() {
  await svc.categories.seedDefaults();
  const cats = await svc.categories.list();
  const by = (n: string, k: "despesa" | "receita" = "despesa") => cats.find((c) => c.name === n && c.kind === k)!;
  const nu = await svc.accounts.create({ name: "Nu", type: "digital", initialBalanceCents: reais(9000) });
  const inter = await svc.accounts.create({ name: "Inter", type: "digital", initialBalanceCents: 0 });
  const card = await svc.cards.create({ name: "Nu", institution: "Nubank", limitCents: reais(5000), closingDay: 12, dueDay: 19 });
  const exp = (a: number, date: string, cat: string | undefined, over = {}) =>
    svc.transactions.create({ type: "despesa", amountCents: reais(a), description: `d${a}`, date, accountId: nu.id, categoryId: cat, ...over });
  return { nu, inter, card, exp, food: by("Alimentação"), fun: by("Lazer"), salary: by("Salário", "receita"), cats, by };
}
const OCT = { from: "2026-10-01", to: "2026-10-31" };

describe("percentages", () => {
  it("somam sempre 100 (maior resto)", () => {
    expect(percentages([1, 1, 1])).toEqual([34, 33, 33]);
    expect(percentages([50, 30, 20])).toEqual([50, 30, 20]);
    expect(percentages([0, 0])).toEqual([0, 0]);
    for (const v of [[1, 2, 3, 4, 5, 6], [333, 333, 334], [1, 99999], [7, 7, 7, 7, 7, 7, 7]]) expect(percentages(v).reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe("previousRange", () => {
  it("mesmo número de meses imediatamente antes", () => {
    expect(previousRange(OCT)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(previousRange({ from: "2026-03-01", to: "2026-03-31" })).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(previousRange({ from: "2026-08-01", to: "2026-10-31" })).toEqual({ from: "2026-05-01", to: "2026-07-31" });
    expect(previousRange({ from: "2026-01-01", to: "2026-12-31" })).toEqual({ from: "2025-01-01", to: "2025-12-31" });
    expect(previousRange({ from: "2026-01-01", to: "2026-01-31" })).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(previousRange({})).toBeNull();
    // mês financeiro que começa no dia 10 (e atravessa a virada do ano)
    expect(previousRange({ from: "2026-10-10", to: "2026-11-09" })).toEqual({ from: "2026-09-10", to: "2026-10-09" });
    expect(previousRange({ from: "2027-01-10", to: "2027-02-09" })).toEqual({ from: "2026-12-10", to: "2027-01-09" });
    expect(previousRange({ from: "2026-08-10", to: "2026-11-09" })).toEqual({ from: "2026-05-10", to: "2026-08-09" });
  });
});

describe("reports.overview", () => {
  it("receita, despesa e saldo do período; transferência e pagamento de fatura ficam de fora; fora do período também", async () => {
    const { nu, inter, card, exp, food, salary } = await setup();
    await svc.transactions.create({ type: "receita", amountCents: reais(3000), description: "Salário", date: "2026-10-05", accountId: nu.id, categoryId: salary.id });
    await exp(100, "2026-10-01", food.id);
    await exp(50, "2026-10-31", food.id);
    await exp(70, "2026-10-12", food.id, { accountId: undefined, cardId: card.id });
    await exp(999, "2026-09-30", food.id);
    await exp(999, "2026-11-01", food.id);
    await svc.transactions.create({ type: "transferencia", amountCents: reais(500), description: "", date: "2026-10-10", accountId: nu.id, toAccountId: inter.id });
    const inv = (await svc.invoices.views({ today: "2026-10-20" })).find((v) => v.invoice.closingDate < "2026-10-20" && !v.invoice.paidAt);
    if (inv) await svc.invoices.pay(inv.invoice.id, { accountId: nu.id, today: "2026-10-20", date: "2026-10-20" });
    const o = await svc.reports.overview(OCT);
    expect(o).toMatchObject({ incomeCents: reais(3000), expenseCents: reais(220), resultCents: reais(2780), count: 4 });
    expect(o.previous).toMatchObject({ expenseCents: reais(999) });
    // receita (com categoria) e transferência não viram fatia de gastos
    expect(o.categories.map((c) => [c.name, c.cents])).toEqual([["Alimentação", reais(220)]]);
  });

  it("limite de fatias: 6 categorias aparecem todas; 7 viram 5 + 'Outras categorias'", async () => {
    const { exp, cats } = await setup();
    const exps = cats.filter((c) => c.kind === "despesa");
    for (let i = 0; i < 6; i++) await exp(100 - i, "2026-10-05", exps[i].id);
    let o = await svc.reports.overview(OCT);
    expect(o.categories).toHaveLength(6);
    expect(o.categories.some((c) => c.categoryId === "outras")).toBe(false);
    await exp(50, "2026-10-05", exps[6].id);
    o = await svc.reports.overview(OCT);
    expect(o.categories).toHaveLength(6);
    expect(o.categories[5]).toMatchObject({ categoryId: "outras", cents: reais(95 + 50) });
  });

  it("despesas por categoria: ordem, percentuais somando 100, sem categoria, e agrupamento de 'Outras'", async () => {
    const { exp, cats } = await setup();
    const exps = cats.filter((c) => c.kind === "despesa");
    expect(exps.length).toBeGreaterThan(7);
    for (let i = 0; i < 8; i++) await exp(100 - i * 5, "2026-10-05", exps[i].id);
    await exp(10, "2026-10-06", undefined);
    const o = await svc.reports.overview(OCT);
    expect(o.categories).toHaveLength(6);
    expect(o.categories[5]).toMatchObject({ categoryId: "outras", name: "Outras categorias" });
    expect(o.categories.reduce((s, c) => s + c.percent, 0)).toBe(100);
    expect(o.categories.reduce((s, c) => s + c.cents, 0)).toBe(o.expenseCents);
    expect(o.categories.map((c) => c.cents).slice(0, 5)).toEqual([reais(100), reais(95), reais(90), reais(85), reais(80)]);
  });

  it("despesa sem categoria (ou com categoria removida) vira 'Sem categoria'", async () => {
    const { exp } = await setup();
    await exp(40, "2026-10-05", undefined);
    await storage.repo("transactions").put({ id: newId(), type: "despesa", amountCents: reais(10), description: "órfã", date: "2026-10-06", accountId: "x", categoryId: "inexistente", createdAt: "", updatedAt: "" } as never); // backup importado
    const o = await svc.reports.overview(OCT);
    expect(o.categories).toEqual([expect.objectContaining({ categoryId: null, name: "Sem categoria", cents: reais(50), percent: 100 })]);
  });

  it("maiores despesas: 4, ordenadas, compras no cartão incluídas, receita não", async () => {
    const { nu, card, exp, food, salary } = await setup();
    await svc.transactions.create({ type: "receita", amountCents: reais(9000), description: "Bônus", date: "2026-10-05", accountId: nu.id, categoryId: salary.id });
    for (const v of [10, 500, 30, 200, 90]) await exp(v, "2026-10-05", food.id);
    await exp(300, "2026-10-07", food.id, { accountId: undefined, cardId: card.id });
    const o = await svc.reports.overview(OCT);
    expect(o.top.map((t) => t.transaction.amountCents)).toEqual([reais(500), reais(300), reais(200), reais(90)]);
    expect(o.top[0]).toMatchObject({ categoryName: "Alimentação" });
  });

  it("período 'tudo' soma tudo e não tem comparação; vazio devolve zeros", async () => {
    const { exp, food } = await setup();
    expect(await svc.reports.overview({})).toMatchObject({ count: 0, expenseCents: 0, categories: [], top: [], previous: null });
    await exp(10, "2025-01-05", food.id); await exp(20, "2026-10-05", food.id);
    expect(await svc.reports.overview({})).toMatchObject({ expenseCents: reais(30), previous: null });
  });
});
