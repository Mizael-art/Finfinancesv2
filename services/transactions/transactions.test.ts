import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { newId } from "@/lib/id";
import { createIndexedDbStorage } from "@/storage/indexeddb";
import type { Storage } from "@/storage/types";
import { createServices, type Services } from "../index";

let storage: Storage;
let svc: Services;
beforeEach(() => {
  storage = createIndexedDbStorage(`tx-${newId()}`);
  svc = createServices(storage);
});
afterEach(() => storage.close());

const reais = (n: number) => Math.round(n * 100);
async function setup() {
  await svc.categories.seedDefaults();
  const cats = await svc.categories.list();
  const nu = await svc.accounts.create({ name: "Nubank", type: "digital", initialBalanceCents: reais(5000) });
  const card = await svc.cards.create({ name: "Nu", institution: "Nubank", limitCents: reais(8000), closingDay: 12, dueDay: 19 });
  return { nu, card, compras: cats.find((c) => c.name === "Compras")!, lazer: cats.find((c) => c.name === "Lazer")! };
}
const balance = async (id: string) => (await svc.accounts.listWithBalances()).find((a) => a.id === id)!.balanceCents;

describe("parcelamento no cartão", () => {
  it("1.200,00 em 12x = 12 parcelas de 100,00, uma por mês, numeradas, no mesmo grupo", async () => {
    const { card, compras } = await setup();
    const parts = await svc.transactions.createInstallments({ type: "despesa", amountCents: reais(1200), description: "Notebook", date: "2026-09-10", cardId: card.id, categoryId: compras.id }, 12);
    expect(parts).toHaveLength(12);
    expect(parts.every((p) => p.amountCents === reais(100))).toBe(true);
    expect(parts.map((p) => p.installmentNumber)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(new Set(parts.map((p) => p.installmentTotal))).toEqual(new Set([12]));
    expect(new Set(parts.map((p) => p.installmentGroupId)).size).toBe(1);
    expect(parts[0].date).toBe("2026-09-10");
    expect(parts[11].date).toBe("2027-08-10");
    expect(await svc.transactions.count()).toBe(12);
  });

  it("a soma das parcelas é SEMPRE o total (resto de centavos nas primeiras)", async () => {
    const { card, compras } = await setup();
    const parts = await svc.transactions.createInstallments({ type: "despesa", amountCents: 10000, description: "x", date: "2026-09-10", cardId: card.id, categoryId: compras.id }, 3);
    expect(parts.map((p) => p.amountCents)).toEqual([3334, 3333, 3333]);
    expect(parts.reduce((s, p) => s + p.amountCents, 0)).toBe(10000);
  });

  it("compra dia 31 mantém o último dia do mês nas parcelas", async () => {
    const { card, compras } = await setup();
    const parts = await svc.transactions.createInstallments({ type: "despesa", amountCents: 3000, description: "x", date: "2026-01-31", cardId: card.id, categoryId: compras.id }, 3);
    expect(parts.map((p) => p.date)).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("não mexe no saldo bancário; o cartão usado conta o valor TODO", async () => {
    const { nu, card, compras } = await setup();
    await svc.transactions.createInstallments({ type: "despesa", amountCents: reais(1200), description: "Notebook", date: "2026-09-10", cardId: card.id, categoryId: compras.id }, 12);
    expect(await balance(nu.id)).toBe(reais(5000));
    expect((await svc.accounts.overview()).cardUsedCents).toBe(reais(1200));
  });

  it("recusa parcelamento inválido e não grava nada", async () => {
    const { nu, card, compras } = await setup();
    const base = { type: "despesa" as const, amountCents: reais(100), description: "x", date: "2026-09-10", cardId: card.id, categoryId: compras.id };
    for (const n of [1, 49, 2.5, 0]) await expect(svc.transactions.createInstallments(base, n)).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.transactions.createInstallments({ ...base, cardId: undefined, accountId: nu.id }, 3)).rejects.toBeInstanceOf(ValidationError); // sem cartão
    await expect(svc.transactions.createInstallments({ ...base, amountCents: 2 }, 3)).rejects.toBeInstanceOf(ValidationError); // valor menor que o nº de parcelas
    await expect(svc.transactions.createInstallments({ ...base, cardId: "fantasma" }, 3)).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.transactions.createInstallments({ ...base, categoryId: "fantasma" }, 3)).rejects.toBeInstanceOf(ValidationError);
    expect(await svc.transactions.count()).toBe(0);
  });

  it("excluir o grupo apaga todas as parcelas; excluir uma deixa as outras", async () => {
    const { card, compras } = await setup();
    const parts = await svc.transactions.createInstallments({ type: "despesa", amountCents: reais(300), description: "x", date: "2026-09-10", cardId: card.id, categoryId: compras.id }, 3);
    await svc.transactions.remove(parts[1].id);
    expect(await svc.transactions.count()).toBe(2);
    await svc.transactions.removeInstallmentGroup(parts[0].installmentGroupId!);
    expect(await svc.transactions.count()).toBe(0);
    await expect(svc.transactions.removeInstallmentGroup("nada")).rejects.toThrow();
  });
});

describe("transação que se repete", () => {
  it("cria o lançamento e a repetição juntos; a repetição começa na data seguinte", async () => {
    const { nu, lazer } = await setup();
    const t = await svc.transactions.createRecurring({ type: "despesa", amountCents: reais(50), description: "Academia", date: "2026-08-15", accountId: nu.id, categoryId: lazer.id }, "mensal");
    const rec = await svc.recurrences.get(t.recurrenceId!);
    expect(rec).toMatchObject({ frequency: "mensal", dayOfMonth: 15, startDate: "2026-09-15", lastGeneratedDate: "2026-08-15", active: true, amountCents: reais(50) });
    expect(await svc.transactions.count()).toBe(1);
  });

  it("depois gera só as ocorrências seguintes, sem repetir a primeira", async () => {
    const { nu, lazer } = await setup();
    await svc.transactions.createRecurring({ type: "despesa", amountCents: reais(50), description: "Academia", date: "2026-08-15", accountId: nu.id, categoryId: lazer.id }, "mensal");
    await svc.recurrences.generateDue({ today: "2026-10-20" });
    expect((await svc.transactions.list()).map((t) => t.date).reverse()).toEqual(["2026-08-15", "2026-09-15", "2026-10-15"]);
    expect(await balance(nu.id)).toBe(reais(5000 - 150));
  });

  it("dia 31 mensal: fevereiro cai no 28 e março volta ao 31", async () => {
    const { nu, lazer } = await setup();
    await svc.transactions.createRecurring({ type: "despesa", amountCents: 100, description: "x", date: "2026-01-31", accountId: nu.id, categoryId: lazer.id }, "mensal");
    await svc.recurrences.generateDue({ today: "2026-03-31" });
    expect((await svc.transactions.list()).map((t) => t.date).reverse()).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("parar a repetição encerra as próximas e mantém as já lançadas", async () => {
    const { nu, lazer } = await setup();
    const t = await svc.transactions.createRecurring({ type: "despesa", amountCents: 100, description: "x", date: "2026-08-15", accountId: nu.id, categoryId: lazer.id }, "semanal");
    await svc.recurrences.stop(t.recurrenceId!);
    await svc.recurrences.generateDue({ today: "2026-12-31" });
    expect(await svc.transactions.count()).toBe(1);
  });

  it("excluir e parar: remove a ocorrência e desativa a repetição numa só gravação", async () => {
    const { nu, lazer } = await setup();
    const t = await svc.transactions.createRecurring({ type: "despesa", amountCents: 100, description: "x", date: "2026-08-15", accountId: nu.id, categoryId: lazer.id }, "mensal");
    await svc.transactions.removeAndStopRecurrence(t.id);
    expect(await svc.transactions.count()).toBe(0);
    expect((await svc.recurrences.get(t.recurrenceId!))!.active).toBe(false);
  });

  it("só receita e despesa se repetem; dados inválidos não gravam nada", async () => {
    const { nu, lazer } = await setup();
    const inter = await svc.accounts.create({ name: "Inter", type: "digital", initialBalanceCents: 0 });
    await expect(svc.transactions.createRecurring({ type: "transferencia", amountCents: 100, description: "", date: "2026-08-15", accountId: nu.id, toAccountId: inter.id }, "mensal")).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.transactions.createRecurring({ type: "despesa", amountCents: 100, description: "x", date: "2026-08-15", accountId: nu.id, categoryId: "fantasma" }, "mensal")).rejects.toBeInstanceOf(ValidationError);
    expect(await svc.transactions.count()).toBe(0);
    expect(await svc.recurrences.list()).toHaveLength(0);
    void lazer;
  });
});
