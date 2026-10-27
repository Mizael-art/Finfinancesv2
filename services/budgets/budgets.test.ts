import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { newId } from "@/lib/id";
import { createIndexedDbStorage } from "@/storage/indexeddb";
import type { Storage } from "@/storage/types";
import { createServices, type Services } from "../index";
import { budgetStatus, spentByCategory } from "./compute";

let storage: Storage;
let svc: Services;
beforeEach(() => { storage = createIndexedDbStorage(`bud-${newId()}`); svc = createServices(storage); });
afterEach(() => storage.close());

const reais = (n: number) => Math.round(n * 100);
async function setup() {
  await svc.categories.seedDefaults();
  const cats = await svc.categories.list();
  const by = (n: string, k: "despesa" | "receita" = "despesa") => cats.find((c) => c.name === n && c.kind === k)!;
  const nu = await svc.accounts.create({ name: "Nubank", type: "digital", initialBalanceCents: reais(9000) });
  const inter = await svc.accounts.create({ name: "Inter", type: "digital", initialBalanceCents: 0 });
  const card = await svc.cards.create({ name: "Nu", institution: "Nubank", limitCents: reais(5000), closingDay: 12, dueDay: 19 });
  return { nu, inter, card, food: by("Alimentação"), fun: by("Lazer"), salary: by("Salário", "receita") };
}

describe("budgetStatus", () => {
  it("limiares 80% e 100%", () => {
    expect(budgetStatus(7999, 10000)).toBe("ok");
    expect(budgetStatus(8000, 10000)).toBe("atencao");
    expect(budgetStatus(9999, 10000)).toBe("atencao");
    expect(budgetStatus(10000, 10000)).toBe("estourado");
    expect(budgetStatus(0, 10000)).toBe("ok");
  });
});

describe("spentByCategory (dado importado inconsistente)", () => {
  it("só despesa conta, mesmo que receita/transferência/pagamento de fatura venham com categoria", () => {
    const base = { description: "", date: "2026-10-05", categoryId: "c", createdAt: "", updatedAt: "" };
    const txs = [
      { ...base, id: "1", type: "despesa", amountCents: 100 },
      { ...base, id: "2", type: "receita", amountCents: 1000 },
      { ...base, id: "3", type: "transferencia", amountCents: 1000 },
      { ...base, id: "4", type: "pagamento_fatura", amountCents: 1000 },
    ] as never[];
    expect(spentByCategory(txs, { from: "2026-10-01", to: "2026-10-31" }).get("c")).toBe(100);
  });
});

describe("budgets.overview", () => {
  it("soma despesas de conta e cartão da categoria no mês; ignora outro mês, receita, transferência e pagamento de fatura", async () => {
    const { nu, inter, card, food } = await setup();
    await svc.budgets.create({ categoryId: food.id, limitCents: reais(500), period: "monthly" });
    const exp = (a: number, date: string, over = {}) => svc.transactions.create({ type: "despesa", amountCents: reais(a), description: "x", date, accountId: nu.id, categoryId: food.id, ...over });
    await exp(100, "2026-10-01");
    await exp(50, "2026-10-31");
    await exp(30, "2026-10-15", { accountId: undefined, cardId: card.id });
    await exp(999, "2026-09-30"); // mês anterior
    await exp(999, "2026-11-01"); // mês seguinte
    await svc.transactions.create({ type: "transferencia", amountCents: reais(200), description: "", date: "2026-10-10", accountId: nu.id, toAccountId: inter.id });
    await exp(70, "2026-09-05", { accountId: undefined, cardId: card.id }); // fatura de setembro, paga em outubro
    const view = (await svc.invoices.views({ today: "2026-10-20" })).find((v) => v.invoice.paidAt === undefined && v.invoice.closingDate < "2026-10-20")!;
    await svc.invoices.pay(view.invoice.id, { accountId: nu.id, today: "2026-10-20", date: "2026-10-20" });
    const o = await svc.budgets.overview("2026-10");
    expect(o.items).toHaveLength(1);
    expect(o.items[0]).toMatchObject({ spentCents: reais(180), remainingCents: reais(320), percent: 36, status: "ok" });
    expect(o.totalLimitCents).toBe(reais(500));
    expect(o.totalSpentCents).toBe(reais(180));
  });

  it("estourado: restante negativo e percentual acima de 100", async () => {
    const { nu, fun } = await setup();
    await svc.budgets.create({ categoryId: fun.id, limitCents: reais(100), period: "monthly" });
    await svc.transactions.create({ type: "despesa", amountCents: reais(250), description: "Show", date: "2026-10-05", accountId: nu.id, categoryId: fun.id });
    const [i] = (await svc.budgets.overview("2026-10")).items;
    expect(i).toMatchObject({ remainingCents: -reais(150), percent: 250, status: "estourado" });
  });

  it("ordena do mais consumido para o menos; categoria sem orçamento aparece em 'unbudgeted'", async () => {
    const { nu, food, fun } = await setup();
    const cats = await svc.categories.list();
    const other = cats.find((c) => c.name === "Transporte" && c.kind === "despesa")!;
    await svc.budgets.create({ categoryId: food.id, limitCents: reais(1000), period: "monthly" });
    await svc.budgets.create({ categoryId: fun.id, limitCents: reais(100), period: "monthly" });
    const tx = (c: string, a: number) => svc.transactions.create({ type: "despesa", amountCents: reais(a), description: "x", date: "2026-10-05", accountId: nu.id, categoryId: c });
    await tx(food.id, 100); await tx(fun.id, 90); await tx(other.id, 40);
    const o = await svc.budgets.overview("2026-10");
    expect(o.items.map((i) => i.category.name)).toEqual(["Lazer", "Alimentação"]);
    expect(o.unbudgeted).toEqual([{ category: other, spentCents: reais(40) }]);
  });

  it("respeita o primeiro dia do mês financeiro das configurações", async () => {
    const { nu, food } = await setup();
    await svc.settings.update({ firstDayOfMonth: 10 });
    await svc.budgets.create({ categoryId: food.id, limitCents: reais(500), period: "monthly" });
    const tx = (a: number, date: string) => svc.transactions.create({ type: "despesa", amountCents: reais(a), description: "x", date, accountId: nu.id, categoryId: food.id });
    await tx(10, "2026-10-09"); // pertence a setembro (10/09–09/10)
    await tx(20, "2026-10-10"); // outubro
    await tx(40, "2026-11-09"); // outubro (até 09/11)
    await tx(80, "2026-11-10"); // novembro
    expect((await svc.budgets.overview("2026-10")).items[0].spentCents).toBe(reais(60));
    expect((await svc.budgets.overview("2026-09")).items[0].spentCents).toBe(reais(10));
    expect(await svc.budgets.currentMonth("2026-10-09")).toBe("2026-09");
    expect(await svc.budgets.currentMonth("2026-10-10")).toBe("2026-10");
  });

  it("orçamento cujo categoria sumiu (dado importado) não quebra nem aparece", async () => {
    const { food } = await setup();
    await storage.repo("budgets").put({ id: newId(), categoryId: "fantasma", limitCents: 100, period: "monthly", createdAt: "x", updatedAt: "x" } as never);
    await svc.budgets.create({ categoryId: food.id, limitCents: 100, period: "monthly" });
    expect((await svc.budgets.overview("2026-10")).items).toHaveLength(1);
  });

  it("sem orçamentos: lista vazia e totais zero", async () => {
    await setup();
    expect(await svc.budgets.overview("2026-10")).toMatchObject({ items: [], totalLimitCents: 0, totalSpentCents: 0, unbudgeted: [] });
  });
});

describe("budgets.suggestLimit", () => {
  it("média dos 3 meses anteriores (meses sem gasto contam como zero)", async () => {
    const { nu, food } = await setup();
    const tx = (a: number, date: string) => svc.transactions.create({ type: "despesa", amountCents: reais(a), description: "x", date, accountId: nu.id, categoryId: food.id });
    await tx(300, "2026-09-10"); await tx(600, "2026-07-10"); // agosto = 0
    await tx(5000, "2026-10-10"); // mês atual não entra
    expect(await svc.budgets.suggestLimit(food.id, "2026-10")).toBe(reais(300));
  });
  it("sem histórico = 0", async () => {
    const { food } = await setup();
    expect(await svc.budgets.suggestLimit(food.id, "2026-10")).toBe(0);
  });
});

describe("budgets CRUD (regras)", () => {
  it("rejeita categoria de receita, duplicada, inexistente e limite inválido; edita sem conflitar consigo mesmo", async () => {
    const { food, salary } = await setup();
    await expect(svc.budgets.create({ categoryId: salary.id, limitCents: 100, period: "monthly" })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.budgets.create({ categoryId: "nada", limitCents: 100, period: "monthly" })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.budgets.create({ categoryId: food.id, limitCents: 0, period: "monthly" })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.budgets.create({ categoryId: food.id, limitCents: 1.5, period: "monthly" })).rejects.toBeInstanceOf(ValidationError);
    const b = await svc.budgets.create({ categoryId: food.id, limitCents: 100, period: "monthly" });
    await expect(svc.budgets.create({ categoryId: food.id, limitCents: 200, period: "monthly" })).rejects.toBeInstanceOf(ValidationError);
    expect((await svc.budgets.update(b.id, { limitCents: 999 })).limitCents).toBe(999);
    await svc.budgets.remove(b.id);
    expect(await svc.budgets.list()).toHaveLength(0);
  });
  it("excluir orçamento não apaga transações", async () => {
    const { nu, food } = await setup();
    const b = await svc.budgets.create({ categoryId: food.id, limitCents: 100, period: "monthly" });
    await svc.transactions.create({ type: "despesa", amountCents: 50, description: "x", date: "2026-10-05", accountId: nu.id, categoryId: food.id });
    await svc.budgets.remove(b.id);
    expect(await svc.transactions.list()).toHaveLength(1);
  });
});
