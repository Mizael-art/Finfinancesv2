import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newId } from "@/lib/id";
import { createIndexedDbStorage } from "@/storage/indexeddb";
import type { Storage } from "@/storage/types";
import { createServices, type Services } from "./index";

let storage: Storage;
let svc: Services;
beforeEach(() => {
  storage = createIndexedDbStorage(`future-${newId()}`);
  svc = createServices(storage);
});
afterEach(() => storage.close());

const FUTURE = "2099-12-15";
const PAST = "2020-01-10";
const balance = async (id: string) => (await svc.accounts.listWithBalances()).find((a) => a.id === id)!.balanceCents;

async function setup() {
  await svc.categories.seedDefaults();
  const cat = (await svc.categories.list("despesa"))[0];
  const rec = (await svc.categories.list("receita"))[0];
  const acc = await svc.accounts.create({ name: "Nubank", type: "digital", initialBalanceCents: 100_000 });
  return { acc, cat, rec };
}

describe("lançamentos com data futura (agendados)", () => {
  it("despesa em Pix para uma data futura não deixa o saldo de hoje negativo", async () => {
    const { acc, cat } = await setup();
    await svc.transactions.create({ type: "despesa", amountCents: 150_000, description: "Pix de dezembro", date: FUTURE, accountId: acc.id, categoryId: cat.id });
    expect(await balance(acc.id)).toBe(100_000);
  });

  it("o que já aconteceu continua contando; o futuro não", async () => {
    const { acc, cat, rec } = await setup();
    await svc.transactions.create({ type: "despesa", amountCents: 10_000, description: "Passado", date: PAST, accountId: acc.id, categoryId: cat.id });
    await svc.transactions.create({ type: "despesa", amountCents: 50_000, description: "Futuro", date: FUTURE, accountId: acc.id, categoryId: cat.id });
    await svc.transactions.create({ type: "receita", amountCents: 70_000, description: "Receita futura", date: FUTURE, accountId: acc.id, categoryId: rec.id });
    expect(await balance(acc.id)).toBe(90_000);
  });

  it("ajustar o saldo de hoje ignora lançamentos futuros", async () => {
    const { acc, cat } = await setup();
    await svc.transactions.create({ type: "despesa", amountCents: 50_000, description: "Futuro", date: FUTURE, accountId: acc.id, categoryId: cat.id });
    await svc.accounts.setCurrentBalance(acc.id, 300_000);
    expect(await balance(acc.id)).toBe(300_000);
  });

  it("o lançamento futuro aparece na busca por data futura e pode ser editado e apagado", async () => {
    const { acc, cat } = await setup();
    const t = await svc.transactions.create({ type: "despesa", amountCents: 50_000, description: "Futuro", date: FUTURE, accountId: acc.id, categoryId: cat.id });
    expect((await svc.transactions.list({ from: "2099-01-01" })).map((x) => x.id)).toEqual([t.id]);
    await svc.transactions.update(t.id, { amountCents: 40_000 });
    expect((await svc.transactions.get(t.id))?.amountCents).toBe(40_000);
    await svc.transactions.remove(t.id);
    expect(await svc.transactions.list({ from: "2099-01-01" })).toHaveLength(0);
  });
});
