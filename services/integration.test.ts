import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newId } from "@/lib/id";
import { createIndexedDbStorage } from "@/storage/indexeddb";
import type { Storage } from "@/storage/types";
import { createServices, type Services } from "./index";

/** Um mês inteiro de uso, conferindo que todas as telas (services) contam a mesma história. */
let storage: Storage;
let svc: Services;
beforeEach(() => { storage = createIndexedDbStorage(`int-${newId()}`); svc = createServices(storage); });
afterEach(() => storage.close());
const R = (n: number) => Math.round(n * 100);
const month = { from: "2026-10-01", to: "2026-10-31" };

async function scenario() {
  await svc.categories.seedDefaults();
  const cats = await svc.categories.list();
  const food = cats.find((c) => c.name === "Alimentação" && c.kind === "despesa")!;
  const sal = cats.find((c) => c.name === "Salário" && c.kind === "receita")!;
  const nu = await svc.accounts.create({ name: "Nubank", type: "digital", initialBalanceCents: R(1000) });
  const inter = await svc.accounts.create({ name: "Inter", type: "digital", initialBalanceCents: R(500) });
  const card = await svc.cards.create({ name: "Nu", institution: "Nubank", limitCents: R(3000), closingDay: 12, dueDay: 19 });
  await svc.transactions.create({ type: "receita", amountCents: R(3000), description: "Salário", date: "2026-10-05", accountId: nu.id, categoryId: sal.id });
  await svc.transactions.create({ type: "despesa", amountCents: R(200), description: "Mercado", date: "2026-10-06", accountId: nu.id, categoryId: food.id });
  await svc.transactions.create({ type: "transferencia", amountCents: R(400), description: "Reserva", date: "2026-10-07", accountId: nu.id, toAccountId: inter.id });
  await svc.transactions.createInstallments({ type: "despesa", amountCents: R(900), description: "Notebook", date: "2026-10-08", cardId: card.id, categoryId: food.id }, 3);
  await svc.budgets.create({ categoryId: food.id, limitCents: R(1000), period: "monthly" });
  const goal = await svc.goals.create({ name: "Viagem", targetCents: R(2000), currentCents: 0, deadline: "2027-06-30", glyph: "V", color: "#7C5CFF" } as never);
  return { nu, inter, card, food, goal };
}

describe("mês completo", () => {
  it("saldos, patrimônio, limite, relatório e orçamento concordam", async () => {
    const { nu, inter, card } = await scenario();
    const bal = async () => Object.fromEntries((await svc.accounts.listWithBalances()).map((a) => [a.name, a.balanceCents]));
    // salário +3000, mercado -200, transferência -400/+400; cartão não mexe em conta
    expect(await bal()).toEqual({ Nubank: R(1000 + 3000 - 200 - 400), Inter: R(500 + 400) });
    expect(await svc.accounts.getNetWorthCents()).toBe(R(1500 + 3000 - 200));
    // relatório: receita 3000; despesa 200 + 900 (compra no cartão conta uma vez só, na data da compra)
    const rep = await svc.reports.overview(month);
    expect(rep.incomeCents).toBe(R(3000));
    // parcelas caem mês a mês: em outubro entram o mercado (200) e a 1ª parcela (300)
    expect(rep.expenseCents).toBe(R(200 + 300));
    expect(rep.categories.reduce((s, c) => s + c.cents, 0)).toBe(R(500));
    void nu; void inter; void card;
  });

  it("pagar a fatura tira da conta uma vez e não muda a despesa do relatório", async () => {
    const { nu } = await scenario();
    const before = (await svc.reports.overview(month)).expenseCents;
    const nuBefore = (await svc.accounts.listWithBalances()).find((a) => a.id === nu.id)!.balanceCents;
    const views = await svc.invoices.views({ today: "2026-10-13" });
    const first = views.sort((a, b) => a.invoice.referenceKey.localeCompare(b.invoice.referenceKey))[0];
    await svc.invoices.pay(first.invoice.id, { accountId: nu.id, today: "2026-10-19" });
    const nuAfter = (await svc.accounts.listWithBalances()).find((a) => a.id === nu.id)!.balanceCents;
    expect(nuBefore - nuAfter).toBe(first.totalCents);
    expect((await svc.reports.overview(month)).expenseCents).toBe(before);
  });

  it("parcelas somam exatamente o valor da compra", async () => {
    await scenario();
    const parts = (await svc.transactions.list()).filter((t) => t.installmentGroupId);
    expect(parts).toHaveLength(3);
    expect(parts.reduce((s, t) => s + t.amountCents, 0)).toBe(R(900));
  });

  it("orçamento da categoria reflete despesas da conta e do cartão", async () => {
    const { food } = await scenario();
    const ov = await svc.budgets.overview("2026-10");
    const item = ov.items.find((i: { budget: { categoryId: string } }) => i.budget.categoryId === food.id) as unknown as Record<string, unknown>;
    expect(item.spentCents).toBe(R(500));
  });

  it("backup → apagar tudo → restaurar devolve os mesmos números", async () => {
    await scenario();
    const snap = async () => ({
      bal: await svc.accounts.listWithBalances().then((l) => l.map((a) => [a.name, a.balanceCents])),
      rep: await svc.reports.overview(month).then((r) => [r.incomeCents, r.expenseCents]),
      net: await svc.accounts.getNetWorthCents(),
    });
    const before = await snap();
    const file = JSON.parse(JSON.stringify(await svc.backup.snapshot()));
    storage.close();
    storage = createIndexedDbStorage(`int-${newId()}`); svc = createServices(storage);
    expect((await svc.accounts.listWithBalances()).length).toBe(0);
    await svc.backup.restore(file);
    expect(await snap()).toEqual(before);
  });
});
