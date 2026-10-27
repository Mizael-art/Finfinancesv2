import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InUseError, NotFoundError, ValidationError } from "@/lib/errors";
import { newId } from "@/lib/id";
import { createIndexedDbStorage } from "@/storage/indexeddb";
import type { Storage } from "@/storage/types";
import type { Account, Category, Transaction } from "@/types/domain";
import { createServices, type Services } from "./index";
import { effectOnAccount } from "./accounts/balance";
import { getInvoiceStatus } from "./invoices/status";
import { DEFAULT_CATEGORIES } from "./categories/defaults";

let storage: Storage;
let svc: Services;
let dbName: string;
const open = () => {
  storage = createIndexedDbStorage(dbName);
  svc = createServices(storage);
};
beforeEach(() => {
  dbName = `test-${newId()}`;
  open();
});
afterEach(() => storage.close());

// ---- helpers ---------------------------------------------------------------
const reais = (n: number) => Math.round(n * 100);
const mkAccount = (name: string, balance: number, over: Partial<Account> = {}) =>
  svc.accounts.create({ name, type: "digital", initialBalanceCents: reais(balance), ...over });

async function setup() {
  await svc.categories.seedDefaults();
  const cats = await svc.categories.list();
  const cat = (name: string, kind: Category["kind"]) => cats.find((c) => c.name === name && c.kind === kind)!;
  return { mercado: cat("Alimentação", "despesa"), salario: cat("Salário", "receita"), lazer: cat("Lazer", "despesa") };
}

const balanceOf = async (id: string) => (await svc.accounts.listWithBalances()).find((a) => a.id === id)!.balanceCents;

// ============================================================================
describe("saldo e patrimônio", () => {
  it("saldo total = soma das contas (2.000 + 1.000 + 200 = 3.200)", async () => {
    await mkAccount("Nubank", 2000);
    await mkAccount("Inter", 1000);
    await mkAccount("Carteira", 200);
    expect(await svc.accounts.getNetWorthCents()).toBe(reais(3200));
  });

  it("receita aumenta o saldo da conta escolhida", async () => {
    const { salario } = await setup();
    const nu = await mkAccount("Nubank", 2000);
    await svc.transactions.create({ type: "receita", amountCents: reais(2500), description: "Salário", date: "2026-09-05", accountId: nu.id, categoryId: salario.id });
    expect(await balanceOf(nu.id)).toBe(reais(4500));
  });

  it("despesa diminui o saldo e a transação continua registrada (2.000 → 1.900)", async () => {
    const { mercado } = await setup();
    const nu = await mkAccount("Nubank", 2000);
    const t = await svc.transactions.create({ type: "despesa", amountCents: reais(100), description: "Mercado", date: "2026-09-06", accountId: nu.id, categoryId: mercado.id });
    expect(await balanceOf(nu.id)).toBe(reais(1900));
    expect((await svc.transactions.list()).map((x) => x.id)).toEqual([t.id]);
  });

  it("TRANSFERÊNCIA não aumenta o patrimônio: 500 do Nubank pro Inter", async () => {
    await setup();
    const nu = await mkAccount("Nubank", 2000);
    const inter = await mkAccount("Inter", 0);
    const before = await svc.accounts.getNetWorthCents();
    await svc.transactions.create({ type: "transferencia", amountCents: reais(500), description: "", date: "2026-09-07", accountId: nu.id, toAccountId: inter.id });
    expect(await balanceOf(nu.id)).toBe(reais(1500));
    expect(await balanceOf(inter.id)).toBe(reais(500));
    expect(await svc.accounts.getNetWorthCents()).toBe(before);
    expect(before).toBe(reais(2000));
  });

  it("transferência não conta como receita nem como despesa", async () => {
    const { salario } = await setup();
    const nu = await mkAccount("Nubank", 0);
    const inter = await mkAccount("Inter", 0);
    await svc.transactions.create({ type: "receita", amountCents: reais(1000), description: "Salário", date: "2026-09-01", accountId: nu.id, categoryId: salario.id });
    await svc.transactions.create({ type: "transferencia", amountCents: reais(400), description: "", date: "2026-09-02", accountId: nu.id, toAccountId: inter.id });
    expect(await svc.transactions.summarize()).toEqual({ incomeCents: reais(1000), expenseCents: 0, resultCents: reais(1000) });
  });

  it("efeito por tipo (função pura)", () => {
    const base = { id: "t", description: "", date: "2026-09-01", createdAt: "", updatedAt: "" } as const;
    const tr: Transaction = { ...base, type: "transferencia", amountCents: 500, accountId: "A", toAccountId: "B" };
    expect(effectOnAccount(tr, "A")).toBe(-500);
    expect(effectOnAccount(tr, "B")).toBe(500);
    expect(effectOnAccount(tr, "C")).toBe(0);
  });

  it("despesa de cartão nunca mexe na conta, nem se um backup importado vier com conta E cartão", () => {
    const base = { id: "t", description: "", date: "2026-09-01", createdAt: "", updatedAt: "", amountCents: 20000 } as const;
    const inconsistente: Transaction = { ...base, type: "despesa", accountId: "A", cardId: "C" };
    expect(effectOnAccount(inconsistente, "A")).toBe(0);
    const normal: Transaction = { ...base, type: "despesa", accountId: "A" };
    expect(effectOnAccount(normal, "A")).toBe(-20000);
  });

  it("editar e excluir recalculam o saldo (saldo é derivado, nunca fica torto)", async () => {
    const { mercado } = await setup();
    const nu = await mkAccount("Nubank", 1000);
    const t = await svc.transactions.create({ type: "despesa", amountCents: reais(100), description: "Mercado", date: "2026-09-06", accountId: nu.id, categoryId: mercado.id });
    expect(await balanceOf(nu.id)).toBe(reais(900));
    await svc.transactions.update(t.id, { amountCents: reais(300) });
    expect(await balanceOf(nu.id)).toBe(reais(700));
    await svc.transactions.remove(t.id);
    expect(await balanceOf(nu.id)).toBe(reais(1000));
  });

  it("conta arquivada sai do patrimônio mas preserva o histórico", async () => {
    await setup();
    const nu = await mkAccount("Nubank", 2000);
    await mkAccount("Inter", 500);
    await svc.accounts.archive(nu.id);
    expect(await svc.accounts.getNetWorthCents()).toBe(reais(500));
    expect(await svc.accounts.list()).toHaveLength(1);
    expect(await svc.accounts.list({ includeArchived: true })).toHaveLength(2);
  });
});

// ============================================================================
describe("cartão de crédito", () => {
  it("compra no cartão NÃO diminui o saldo bancário, mas conta como despesa", async () => {
    const { mercado } = await setup();
    const nu = await mkAccount("Nubank", 2000);
    const card = await svc.cards.create({ name: "Nubank", institution: "Nubank", limitCents: reais(5000), closingDay: 12, dueDay: 19 });
    await svc.transactions.create({ type: "despesa", amountCents: reais(200), description: "Mercado", date: "2026-09-06", cardId: card.id, categoryId: mercado.id });
    expect(await balanceOf(nu.id)).toBe(reais(2000));
    expect((await svc.transactions.summarize()).expenseCents).toBe(reais(200));
  });

  it("pagamento da fatura diminui a conta e NÃO duplica a despesa", async () => {
    const { mercado } = await setup();
    const nu = await mkAccount("Nubank", 2000);
    const card = await svc.cards.create({ name: "Nubank", institution: "Nubank", limitCents: reais(5000), closingDay: 12, dueDay: 19 });
    await svc.transactions.create({ type: "despesa", amountCents: reais(200), description: "Mercado", date: "2026-09-06", cardId: card.id, categoryId: mercado.id });
    const [inv] = await svc.invoices.views({ today: "2026-09-13" });
    await svc.invoices.pay(inv.invoice.id, { accountId: nu.id, today: "2026-09-19" });
    expect(await balanceOf(nu.id)).toBe(reais(1800));
    expect((await svc.transactions.summarize()).expenseCents).toBe(reais(200)); // uma vez só
  });

  it("pagamento de fatura não pode ser criado, editado nem excluído direto", async () => {
    await setup();
    const nu = await mkAccount("Nubank", 2000);
    const card = await svc.cards.create({ name: "N", institution: "N", limitCents: 10000, closingDay: 1, dueDay: 8 });
    const { mercado } = await setup();
    await svc.transactions.create({ type: "despesa", amountCents: 100, description: "x", date: "2026-08-20", cardId: card.id, categoryId: mercado.id });
    const [inv] = await svc.invoices.views({ today: "2026-09-02" });
    await expect(svc.transactions.create({ type: "pagamento_fatura", amountCents: 100, description: "", date: "2026-09-08", accountId: nu.id, invoiceId: inv.invoice.id })).rejects.toBeInstanceOf(ValidationError);
    const pay = await svc.invoices.pay(inv.invoice.id, { accountId: nu.id, today: "2026-09-02" });
    await expect(svc.transactions.remove(pay.id)).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.transactions.update(pay.id, { amountCents: 5 })).rejects.toBeInstanceOf(ValidationError);
  });

  it("despesa precisa de conta OU cartão, nunca os dois nem nenhum", async () => {
    const { mercado } = await setup();
    const nu = await mkAccount("Nubank", 100);
    const card = await svc.cards.create({ name: "N", institution: "N", limitCents: 100, closingDay: 1, dueDay: 8 });
    const base = { type: "despesa" as const, amountCents: 100, description: "x", date: "2026-09-01", categoryId: mercado.id };
    await expect(svc.transactions.create({ ...base, accountId: nu.id, cardId: card.id })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.transactions.create({ ...base })).rejects.toBeInstanceOf(ValidationError);
  });

  it("status da fatura é derivado das datas e do pagamento", () => {
    const inv = { closingDate: "2026-09-12", dueDate: "2026-09-19" };
    expect(getInvoiceStatus(inv, "2026-09-12")).toBe("aberta");
    expect(getInvoiceStatus(inv, "2026-09-13")).toBe("fechada");
    expect(getInvoiceStatus(inv, "2026-09-19")).toBe("fechada");
    expect(getInvoiceStatus(inv, "2026-09-20")).toBe("atrasada");
    expect(getInvoiceStatus({ ...inv, paidAt: "2026-09-18T12:00:00.000Z" }, "2026-09-30")).toBe("paga");
  });

  it("valida cartão e fatura; protege exclusão", async () => {
    const { mercado } = await setup();
    await expect(svc.cards.create({ name: "X", institution: "X", limitCents: 100, closingDay: 32, dueDay: 8 })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.cards.create({ name: "X", institution: "X", limitCents: 100, closingDay: 5, dueDay: 8, last4: "12a4" })).rejects.toBeInstanceOf(ValidationError);
    const card = await svc.cards.create({ name: "N", institution: "N", limitCents: 100, closingDay: 5, dueDay: 12, last4: "4482" });
    await expect(svc.invoices.create({ cardId: card.id, referenceKey: "2026-09", closingDate: "2026-09-20", dueDate: "2026-09-10" })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.invoices.create({ cardId: "nao-existe", referenceKey: "2026-09", closingDate: "2026-09-01", dueDate: "2026-09-08" })).rejects.toBeInstanceOf(ValidationError);
    await svc.transactions.create({ type: "despesa", amountCents: 50, description: "x", date: "2026-09-01", cardId: card.id, categoryId: mercado.id });
    const [inv] = await svc.invoices.views({ today: "2026-09-02" });
    await expect(svc.invoices.remove(inv.invoice.id)).rejects.toBeInstanceOf(InUseError);
    await expect(svc.cards.remove(card.id)).rejects.toBeInstanceOf(InUseError);
  });
});

// ============================================================================
describe("validação de transações", () => {
  it("recusa valor zero, negativo e fracionário (só centavos inteiros)", async () => {
    const { mercado } = await setup();
    const nu = await mkAccount("Nubank", 100);
    const t = { type: "despesa" as const, description: "x", date: "2026-09-01", accountId: nu.id, categoryId: mercado.id };
    for (const amountCents of [0, -100, 10.5, Number.NaN]) {
      await expect(svc.transactions.create({ ...t, amountCents })).rejects.toBeInstanceOf(ValidationError);
    }
  });

  it("recusa data inválida, descrição vazia e transferência para a mesma conta", async () => {
    const { mercado } = await setup();
    const nu = await mkAccount("Nubank", 100);
    const t = { type: "despesa" as const, amountCents: 100, description: "x", date: "2026-09-01", accountId: nu.id, categoryId: mercado.id };
    await expect(svc.transactions.create({ ...t, date: "2026-02-30" })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.transactions.create({ ...t, description: "   " })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.transactions.create({ type: "transferencia", amountCents: 100, description: "", date: "2026-09-01", accountId: nu.id, toAccountId: nu.id })).rejects.toBeInstanceOf(ValidationError);
  });

  it("confere vínculos: conta inexistente/arquivada e categoria do tipo errado", async () => {
    const { mercado, salario } = await setup();
    const nu = await mkAccount("Nubank", 100);
    const t = { type: "despesa" as const, amountCents: 100, description: "x", date: "2026-09-01", accountId: nu.id, categoryId: mercado.id };
    await expect(svc.transactions.create({ ...t, accountId: "fantasma" })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.transactions.create({ ...t, categoryId: salario.id })).rejects.toBeInstanceOf(ValidationError); // receita numa despesa
    await svc.accounts.archive(nu.id);
    await expect(svc.transactions.create(t)).rejects.toBeInstanceOf(ValidationError);
  });

  it("nada é gravado quando a validação falha", async () => {
    await setup();
    await expect(svc.transactions.create({ type: "receita", amountCents: 100, description: "x", date: "2026-09-01" })).rejects.toThrow();
    expect(await svc.transactions.list()).toHaveLength(0);
  });
});

// ============================================================================
describe("listagem e filtros", () => {
  it("ordena do mais recente ao mais antigo e filtra por período, tipo, conta e texto", async () => {
    const { mercado, salario } = await setup();
    const nu = await mkAccount("Nubank", 0);
    const inter = await mkAccount("Inter", 0);
    const mk = (over: Partial<Transaction> & Pick<Transaction, "type" | "date" | "description">) =>
      svc.transactions.create({ amountCents: 100, accountId: nu.id, categoryId: over.type === "receita" ? salario.id : mercado.id, ...over });
    await mk({ type: "despesa", date: "2026-09-01", description: "Padaria Pão Quente" });
    await mk({ type: "receita", date: "2026-09-10", description: "Salário" });
    await mk({ type: "despesa", date: "2026-08-31", description: "Farmácia" });
    await svc.transactions.create({ type: "transferencia", amountCents: 100, description: "Reserva", date: "2026-09-05", accountId: nu.id, toAccountId: inter.id });

    expect((await svc.transactions.list()).map((t) => t.date)).toEqual(["2026-09-10", "2026-09-05", "2026-09-01", "2026-08-31"]);
    expect(await svc.transactions.list({ from: "2026-09-01", to: "2026-09-30" })).toHaveLength(3);
    expect(await svc.transactions.list({ type: "despesa" })).toHaveLength(2);
    expect(await svc.transactions.list({ accountId: inter.id })).toHaveLength(1); // casa pelo destino
    expect((await svc.transactions.list({ search: "pao" }))[0].description).toBe("Padaria Pão Quente"); // sem acento
    expect(await svc.transactions.recent(2)).toHaveLength(2);
  });
});

// ============================================================================
describe("exclusões protegidas", () => {
  it("conta com transações não pode ser excluída; sem vínculos pode", async () => {
    const { mercado } = await setup();
    const nu = await mkAccount("Nubank", 100);
    const vazia = await mkAccount("Vazia", 0);
    await svc.transactions.create({ type: "despesa", amountCents: 10, description: "x", date: "2026-09-01", accountId: nu.id, categoryId: mercado.id });
    await expect(svc.accounts.remove(nu.id)).rejects.toBeInstanceOf(InUseError);
    await svc.accounts.remove(vazia.id);
    expect(await svc.accounts.get(vazia.id)).toBeUndefined();
  });

  it("nome de conta é único (sem diferenciar maiúsculas)", async () => {
    await mkAccount("Nubank", 0);
    await expect(mkAccount("nubank", 0)).rejects.toBeInstanceOf(ValidationError);
  });

  it("excluir algo inexistente lança NotFoundError", async () => {
    await expect(svc.accounts.remove("nada")).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ============================================================================
describe("categorias", () => {
  it("seedDefaults cria as padrão e é idempotente", async () => {
    expect(await svc.categories.seedDefaults()).toBe(DEFAULT_CATEGORIES.length);
    expect(await svc.categories.seedDefaults()).toBe(0);
    const all = await svc.categories.list();
    expect(all).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(all.every((c) => c.isDefault && c.color)).toBe(true);
    expect(all.filter((c) => c.name === "Outros")).toHaveLength(2); // despesa e receita
  });

  it("as categorias padrão voltam sempre na ordem da lista (Salário é a 1ª receita, Alimentação a 1ª despesa)", async () => {
    await svc.categories.seedDefaults();
    const names = (kind: "despesa" | "receita") => DEFAULT_CATEGORIES.filter((d) => d.kind === kind).map((d) => d.name);
    expect((await svc.categories.list("despesa")).map((c) => c.name)).toEqual(names("despesa"));
    expect((await svc.categories.list("receita")).map((c) => c.name)).toEqual(names("receita"));
  });

  it("categoria padrão não pode ser excluída; nomes são únicos por tipo", async () => {
    const { mercado } = await setup();
    await expect(svc.categories.remove(mercado.id)).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.categories.create({ name: "alimentação", kind: "despesa" })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.categories.create({ name: "Alimentação", kind: "receita" })).resolves.toBeTruthy();
  });

  it("categoria em uso só é excluída depois de reatribuir — tudo ou nada", async () => {
    const { mercado } = await setup();
    const nu = await mkAccount("Nubank", 1000);
    const pet = await svc.categories.create({ name: "Pet", kind: "despesa" });
    const t = await svc.transactions.create({ type: "despesa", amountCents: 100, description: "Ração", date: "2026-09-01", accountId: nu.id, categoryId: pet.id });
    await svc.budgets.create({ categoryId: pet.id, limitCents: 30000, period: "monthly" });

    await expect(svc.categories.remove(pet.id)).rejects.toBeInstanceOf(InUseError);
    expect((await svc.categories.usage(pet.id)).total).toBe(2);

    const receita = (await svc.categories.list("receita"))[0];
    await expect(svc.categories.remove(pet.id, { reassignToCategoryId: receita.id })).rejects.toBeInstanceOf(ValidationError); // tipo errado
    expect(await svc.categories.get(pet.id)).toBeTruthy(); // nada mudou

    await svc.categories.remove(pet.id, { reassignToCategoryId: mercado.id });
    expect(await svc.categories.get(pet.id)).toBeUndefined();
    expect((await svc.transactions.get(t.id))?.categoryId).toBe(mercado.id);
    expect((await svc.budgets.list())[0].categoryId).toBe(mercado.id);
  });

  it("se o destino já tem orçamento, o da categoria excluída é descartado", async () => {
    const { mercado } = await setup();
    const pet = await svc.categories.create({ name: "Pet", kind: "despesa" });
    await svc.budgets.create({ categoryId: mercado.id, limitCents: 80000, period: "monthly" });
    await svc.budgets.create({ categoryId: pet.id, limitCents: 30000, period: "monthly" });
    await svc.categories.remove(pet.id, { reassignToCategoryId: mercado.id });
    const budgets = await svc.budgets.list();
    expect(budgets).toHaveLength(1);
    expect(budgets[0].limitCents).toBe(80000);
  });

  it("orçamento: só categoria de despesa, uma por categoria, limite positivo", async () => {
    const { mercado, salario } = await setup();
    await expect(svc.budgets.create({ categoryId: salario.id, limitCents: 100, period: "monthly" })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.budgets.create({ categoryId: mercado.id, limitCents: 0, period: "monthly" })).rejects.toBeInstanceOf(ValidationError);
    await svc.budgets.create({ categoryId: mercado.id, limitCents: 100, period: "monthly" });
    await expect(svc.budgets.create({ categoryId: mercado.id, limitCents: 200, period: "monthly" })).rejects.toBeInstanceOf(ValidationError);
  });
});

// ============================================================================
describe("configurações, perfil e renda", () => {
  it("settings devolve padrões, mescla backup e persiste o onboarding", async () => {
    const first = await svc.settings.get();
    expect(first).toMatchObject({ onboardingCompleted: false, theme: "preto", currency: "BRL", firstDayOfMonth: 1 });
    expect(await svc.settings.isOnboardingCompleted()).toBe(false);
    await svc.settings.update({ backup: { googleConnected: true } });
    await svc.settings.update({ backup: { autoBackup: true } }); // não perde o campo anterior
    await svc.settings.completeOnboarding();
    storage.close();
    open(); // "reabre o navegador"
    const after = await svc.settings.get();
    expect(after.onboardingCompleted).toBe(true);
    expect(after.backup).toMatchObject({ googleConnected: true, autoBackup: true, pending: false });
    expect(await storage.repo("settings").count()).toBe(1); // registro único
  });

  it("settings valida tema e primeiro dia do mês", async () => {
    await expect(svc.settings.update({ firstDayOfMonth: 31 })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.settings.update({ theme: "roxo" as never })).rejects.toBeInstanceOf(ValidationError);
  });

  it("perfil local é único: salvar de novo atualiza em vez de duplicar", async () => {
    expect(await svc.users.getCurrent()).toBeUndefined();
    const a = await svc.users.save({ name: "Marina" });
    const b = await svc.users.save({ name: "Marina Souza", email: "marina@email.com" });
    expect(b.id).toBe(a.id);
    expect(await storage.repo("users").count()).toBe(1);
    expect((await svc.users.getCurrent())?.email).toBe("marina@email.com");
    await expect(svc.users.save({ name: "", email: "x" })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.users.save({ name: "Ok", email: "sem-arroba" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("só uma fonte de renda pode ser a principal", async () => {
    const a = await svc.income.create({ name: "Salário", amountCents: reais(5000), payDay: 5, kind: "fixa", isPrimary: true });
    const b = await svc.income.create({ name: "Freela", amountCents: reais(800), payDay: 20, kind: "variavel", isPrimary: true });
    const list = await svc.income.list();
    expect(list.filter((s) => s.isPrimary).map((s) => s.id)).toEqual([b.id]);
    await svc.income.update(a.id, { isPrimary: true });
    expect((await svc.income.list()).filter((s) => s.isPrimary).map((s) => s.id)).toEqual([a.id]);
    await expect(svc.income.create({ name: "X", amountCents: 100, payDay: 32, kind: "fixa", isPrimary: false })).rejects.toBeInstanceOf(ValidationError);
  });

  it("metas, investimentos e recorrências validam e persistem", async () => {
    await setup();
    const g = await svc.goals.create({ name: "Viagem", targetCents: reais(5000), currentCents: reais(1000), deadline: "2027-06-01" });
    expect((await svc.goals.get(g.id))?.targetCents).toBe(reais(5000));
    await expect(svc.goals.create({ name: "Zero", targetCents: 0, currentCents: 0 })).rejects.toBeInstanceOf(ValidationError);

    await expect(svc.investments.create({ name: "PETR4", type: "acoes", investedCents: 100, currentCents: 100, date: "2026-13-01" })).rejects.toBeInstanceOf(ValidationError);
    await svc.investments.create({ name: "PETR4", type: "acoes", investedCents: reais(3420), currentCents: reais(3810), quantity: 100, avgPriceCents: reais(34.2), date: "2025-08-14" });
    expect(await svc.investments.list()).toHaveLength(1);

    const rent = (await svc.categories.list("despesa")).find((c) => c.name === "Moradia")!;
    await svc.recurrences.create({ type: "despesa", description: "Aluguel", amountCents: reais(1500), categoryId: rent.id, frequency: "mensal", dayOfMonth: 5, active: true, startDate: "2026-09-01" });
    await expect(svc.recurrences.create({ type: "despesa", description: "Ruim", amountCents: 100, frequency: "mensal", dayOfMonth: 5, active: true, startDate: "2026-09-10", endDate: "2026-09-01" })).rejects.toBeInstanceOf(ValidationError);
  });
});

// ============================================================================
describe("registros e eventos", () => {
  it("gera id único, createdAt/updatedAt e preserva createdAt ao editar", async () => {
    const a = await mkAccount("Nubank", 0);
    const b = await mkAccount("Inter", 0);
    expect(a.id).not.toBe(b.id);
    expect(a.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    await new Promise((r) => setTimeout(r, 5));
    const edited = await svc.accounts.update(a.id, { name: "Nubank Roxinho" });
    expect(edited.createdAt).toBe(a.createdAt);
    expect(edited.updatedAt > a.updatedAt).toBe(true);
    expect(edited.id).toBe(a.id);
  });

  it("services avisam quando os dados mudam (base para UI reativa e backup)", async () => {
    const seen: string[] = [];
    svc.subscribe((e) => seen.push(...e.stores));
    const nu = await mkAccount("Nubank", 0);
    await svc.accounts.update(nu.id, { name: "Nu" });
    expect(seen).toEqual(["accounts", "accounts"]);
  });

  it("os dados sobrevivem a fechar e reabrir (persistência real)", async () => {
    const { mercado } = await setup();
    const nu = await mkAccount("Nubank", 1000);
    await svc.transactions.create({ type: "despesa", amountCents: reais(250), description: "Mercado", date: "2026-09-06", accountId: nu.id, categoryId: mercado.id });
    storage.close();
    open();
    expect(await balanceOf(nu.id)).toBe(reais(750));
    expect(await svc.transactions.list()).toHaveLength(1);
  });
});
