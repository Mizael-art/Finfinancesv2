import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InUseError, ValidationError } from "@/lib/errors";
import { newId } from "@/lib/id";
import { createIndexedDbStorage } from "@/storage/indexeddb";
import type { Storage } from "@/storage/types";
import { createServices, type Services } from "../index";

let storage: Storage;
let svc: Services;
beforeEach(() => {
  storage = createIndexedDbStorage(`cat-${newId()}`);
  svc = createServices(storage);
});
afterEach(() => storage.close());

const reais = (n: number) => Math.round(n * 100);
async function setup() {
  await svc.categories.seedDefaults();
  const cats = await svc.categories.list();
  const by = (name: string, kind: "despesa" | "receita") => cats.find((c) => c.name === name && c.kind === kind)!;
  const nu = await svc.accounts.create({ name: "Nubank", type: "digital", initialBalanceCents: reais(5000) });
  const inter = await svc.accounts.create({ name: "Inter", type: "digital", initialBalanceCents: 0 });
  const card = await svc.cards.create({ name: "Nu", institution: "Nubank", limitCents: reais(5000), closingDay: 12, dueDay: 19 });
  return { nu, inter, card, food: by("Alimentação", "despesa"), fun: by("Lazer", "despesa"), salary: by("Salário", "receita") };
}
const find = async (id: string, range = {}) => (await svc.categories.overview(range)).find((o) => o.category.id === id)!;

describe("categories.overview", () => {
  it("soma despesas (conta e cartão) e receitas por categoria, só dentro do período", async () => {
    const { nu, card, food, salary } = await setup();
    const exp = (amount: number, date: string, over = {}) => svc.transactions.create({ type: "despesa", amountCents: reais(amount), description: "x", date, accountId: nu.id, categoryId: food.id, ...over });
    await exp(100, "2026-09-05");
    await exp(50, "2026-09-20", { accountId: undefined, cardId: card.id }); // cartão também conta
    await exp(999, "2026-08-31"); // fora do período
    await svc.transactions.create({ type: "receita", amountCents: reais(3000), description: "Salário", date: "2026-09-05", accountId: nu.id, categoryId: salary.id });
    const range = { from: "2026-09-01", to: "2026-09-30" };
    expect(await find(food.id, range)).toMatchObject({ periodCents: reais(150), periodCount: 2 });
    expect(await find(salary.id, range)).toMatchObject({ periodCents: reais(3000), periodCount: 1 });
    expect((await find(food.id)).periodCents).toBe(reais(1149)); // sem período: tudo
  });

  it("transferência e pagamento de fatura não entram em nenhuma categoria", async () => {
    const { nu, inter, card, food } = await setup();
    await svc.transactions.create({ type: "despesa", amountCents: reais(200), description: "Mercado", date: "2026-09-05", cardId: card.id, categoryId: food.id });
    await svc.transactions.create({ type: "transferencia", amountCents: reais(100), description: "", date: "2026-09-06", accountId: nu.id, toAccountId: inter.id });
    const [view] = await svc.invoices.views({ today: "2026-09-13" });
    await svc.invoices.pay(view.invoice.id, { accountId: nu.id, today: "2026-09-13" });
    const all = await svc.categories.overview();
    expect(all.reduce((s, o) => s + o.periodCents, 0)).toBe(reais(200)); // só a compra, uma vez
  });

  it("mostra onde a categoria é usada (transações, orçamentos, repetições)", async () => {
    const { nu, food } = await setup();
    await svc.transactions.create({ type: "despesa", amountCents: 100, description: "x", date: "2026-09-05", accountId: nu.id, categoryId: food.id });
    await svc.budgets.create({ categoryId: food.id, limitCents: 10000, period: "monthly" });
    await svc.recurrences.create({ type: "despesa", description: "Feira", amountCents: 100, categoryId: food.id, accountId: nu.id, frequency: "mensal", dayOfMonth: 5, active: true, startDate: "2026-09-01" });
    expect((await find(food.id)).usage).toEqual({ transactions: 1, budgets: 1, recurrences: 1 });
  });

  it("dado inconsistente (receita apontando para categoria de despesa, ex.: backup importado) não infla o total", async () => {
    const { nu, food } = await setup();
    const now = new Date().toISOString();
    await storage.repo("transactions").put({ id: "x", type: "receita", amountCents: reais(500), description: "estranha", date: "2026-09-05", accountId: nu.id, categoryId: food.id, createdAt: now, updatedAt: now });
    expect(await find(food.id)).toMatchObject({ periodCents: 0, periodCount: 0 });
  });

  it("categoria sem movimento aparece com zero", async () => {
    const { fun } = await setup();
    expect(await find(fun.id)).toMatchObject({ periodCents: 0, periodCount: 0, usage: { transactions: 0, budgets: 0, recurrences: 0 } });
  });
});

describe("criar e editar categorias", () => {
  it("cor precisa ser #RRGGBB e é guardada em maiúsculas; sem cor usa a padrão", async () => {
    const a = await svc.categories.create({ name: "Pet", kind: "despesa", color: "#ff8800" });
    expect(a.color).toBe("#FF8800");
    await expect(svc.categories.create({ name: "Ruim", kind: "despesa", color: "vermelho" })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.categories.create({ name: "Ruim2", kind: "despesa", color: "#fff" })).rejects.toBeInstanceOf(ValidationError);
    expect((await svc.categories.create({ name: "Sem cor", kind: "despesa" })).color).toBeTruthy();
  });

  it("nome: obrigatório, até 40 caracteres, único por tipo (sem diferenciar maiúsculas)", async () => {
    await expect(svc.categories.create({ name: "  ", kind: "despesa" })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.categories.create({ name: "x".repeat(41), kind: "despesa" })).rejects.toBeInstanceOf(ValidationError);
    await svc.categories.create({ name: "Pet", kind: "despesa" });
    await expect(svc.categories.create({ name: "PET", kind: "despesa" })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.categories.create({ name: "Pet", kind: "receita" })).resolves.toBeTruthy();
  });

  it("renomear e recolorir uma padrão vale, mas ela continua padrão e protegida contra exclusão", async () => {
    const { food } = await setup();
    const edited = await svc.categories.update(food.id, { name: "Mercado e feira", color: "#00AA55" });
    expect(edited).toMatchObject({ name: "Mercado e feira", color: "#00AA55", isDefault: true });
    await expect(svc.categories.update(food.id, { isDefault: false })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.categories.remove(food.id)).rejects.toBeInstanceOf(ValidationError);
  });

  it("renomear para um nome que já existe no mesmo tipo é recusado", async () => {
    const { food } = await setup();
    await expect(svc.categories.update(food.id, { name: "lazer" })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.categories.update(food.id, { name: "Alimentação" })).resolves.toBeTruthy(); // o próprio nome não conflita
  });

  it("renomear não mexe nas transações (elas guardam o id, não o nome)", async () => {
    const { nu } = await setup();
    const pet = await svc.categories.create({ name: "Pet", kind: "despesa" });
    const t = await svc.transactions.create({ type: "despesa", amountCents: 100, description: "Ração", date: "2026-09-05", accountId: nu.id, categoryId: pet.id });
    await svc.categories.update(pet.id, { name: "Animais" });
    expect((await svc.transactions.get(t.id))!.categoryId).toBe(pet.id);
  });
});

describe("excluir categoria", () => {
  it("sem uso: exclui direto", async () => {
    await setup();
    const pet = await svc.categories.create({ name: "Pet", kind: "despesa" });
    await svc.categories.remove(pet.id);
    expect(await svc.categories.get(pet.id)).toBeUndefined();
  });

  it("em uso por repetição: exige reatribuir e a repetição passa a usar a nova categoria", async () => {
    const { nu, food } = await setup();
    const pet = await svc.categories.create({ name: "Pet", kind: "despesa" });
    const rec = await svc.recurrences.create({ type: "despesa", description: "Ração", amountCents: 100, categoryId: pet.id, accountId: nu.id, frequency: "mensal", dayOfMonth: 5, active: true, startDate: "2026-09-01" });
    await expect(svc.categories.remove(pet.id)).rejects.toBeInstanceOf(InUseError);
    await svc.categories.remove(pet.id, { reassignToCategoryId: food.id });
    expect((await svc.recurrences.get(rec.id))!.categoryId).toBe(food.id);
  });

  it("reatribuir para ela mesma ou para uma inexistente é recusado e nada muda", async () => {
    const { nu } = await setup();
    const pet = await svc.categories.create({ name: "Pet", kind: "despesa" });
    const t = await svc.transactions.create({ type: "despesa", amountCents: 100, description: "x", date: "2026-09-05", accountId: nu.id, categoryId: pet.id });
    await expect(svc.categories.remove(pet.id, { reassignToCategoryId: pet.id })).rejects.toThrow();
    await expect(svc.categories.remove(pet.id, { reassignToCategoryId: "fantasma" })).rejects.toThrow();
    expect(await svc.categories.get(pet.id)).toBeTruthy();
    expect((await svc.transactions.get(t.id))!.categoryId).toBe(pet.id);
  });
});

describe("categorias padrão: sem duplicar", () => {
  it("duas semeadas ao mesmo tempo criam cada categoria uma vez só", async () => {
    await Promise.all([svc.categories.seedDefaults(), svc.categories.seedDefaults(), svc.categories.seedDefaults()]);
    const names = (await svc.categories.list()).map((c) => `${c.kind}:${c.name}`);
    expect(names).toHaveLength(13);
    expect(new Set(names).size).toBe(13);
  });
  it("seedDefaults depois de pronto não cria nada", async () => {
    await svc.categories.seedDefaults();
    expect(await svc.categories.seedDefaults()).toBe(0);
  });
  it("repairDefaults apaga cópia vazia e mantém a que tem uso", async () => {
    await svc.categories.seedDefaults();
    const all = await svc.categories.list();
    const food = all.find((c) => c.name === "Alimentação" && c.kind === "despesa")!;
    const dup = { ...food, id: newId(), createdAt: "2099-01-01T00:00:00.000Z" };
    await storage.repo("categories").put(dup);
    const dup2 = { ...food, id: newId(), createdAt: "2099-01-02T00:00:00.000Z" };
    await storage.repo("categories").put(dup2);
    const acc = await svc.accounts.create({ name: "Nu", type: "digital", initialBalanceCents: 0 });
    await svc.transactions.create({ type: "despesa", amountCents: 100, description: "x", date: "2026-10-01", accountId: acc.id, categoryId: dup.id });
    await svc.categories.repairDefaults();
    const ids = (await svc.categories.list()).filter((c) => c.name === "Alimentação" && c.kind === "despesa").map((c) => c.id);
    expect(ids).toEqual([dup.id]); // a usada fica; as vazias saem
  });
});
