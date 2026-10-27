import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InUseError, ValidationError } from "@/lib/errors";
import { newId } from "@/lib/id";
import { createIndexedDbStorage } from "@/storage/indexeddb";
import type { Storage } from "@/storage/types";
import { createServices, type Services } from "../index";

let storage: Storage;
let svc: Services;
beforeEach(() => {
  storage = createIndexedDbStorage(`inv-${newId()}`);
  svc = createServices(storage);
});
afterEach(() => storage.close());

const reais = (n: number) => Math.round(n * 100);
async function setup(balance = 5000) {
  await svc.categories.seedDefaults();
  const cats = await svc.categories.list("despesa");
  const nu = await svc.accounts.create({ name: "Nubank", type: "digital", initialBalanceCents: reais(balance) });
  const card = await svc.cards.create({ name: "Nu Roxinho", institution: "Nubank", limitCents: reais(5000), closingDay: 12, dueDay: 19 });
  return { nu, card, cat: cats[0] };
}
const buy = (cardId: string, categoryId: string, amount: number, date: string, description = "Compra") =>
  svc.transactions.create({ type: "despesa", amountCents: reais(amount), description, date, cardId, categoryId });
const balance = async (id: string) => (await svc.accounts.listWithBalances()).find((a) => a.id === id)!.balanceCents;
const cardView = async (id: string, today = "2026-09-10") => (await svc.cards.overview({ today })).find((c) => c.id === id)!;

describe("compra no cartão → fatura", () => {
  it("cria a fatura do ciclo certo e soma as compras dela", async () => {
    const { card, cat } = await setup();
    const a = await buy(card.id, cat.id, 100, "2026-09-06");
    const b = await buy(card.id, cat.id, 50.5, "2026-09-12");
    const c = await buy(card.id, cat.id, 30, "2026-09-13");
    expect(a.invoiceId).toBe(`inv:${card.id}:2026-09`);
    expect(b.invoiceId).toBe(a.invoiceId);
    expect(c.invoiceId).toBe(`inv:${card.id}:2026-10`);
    const views = await svc.invoices.views({ today: "2026-09-10" });
    expect(views.map((v) => [v.invoice.referenceKey, v.totalCents, v.purchaseCount, v.status])).toEqual([
      ["2026-10", reais(30), 1, "aberta"],
      ["2026-09", reais(150.5), 2, "aberta"],
    ]);
  });

  it("não cria fatura duplicada: compras no mesmo ciclo reutilizam a mesma", async () => {
    const { card, cat } = await setup();
    await Promise.all([buy(card.id, cat.id, 10, "2026-09-01"), buy(card.id, cat.id, 10, "2026-09-02")]);
    expect(await storage.repo("invoices").count()).toBe(1);
  });

  it("status vem das datas: aberta → fechada → atrasada", async () => {
    const { card, cat } = await setup();
    await buy(card.id, cat.id, 100, "2026-09-06");
    const st = async (today: string) => (await svc.invoices.views({ today }))[0].status;
    expect(await st("2026-09-12")).toBe("aberta");
    expect(await st("2026-09-13")).toBe("fechada");
    expect(await st("2026-09-19")).toBe("fechada");
    expect(await st("2026-09-20")).toBe("atrasada");
  });

  it("compra de cartão não mexe no saldo da conta, mas consome o limite", async () => {
    const { nu, card, cat } = await setup();
    await buy(card.id, cat.id, 1760, "2026-09-06");
    expect(await balance(nu.id)).toBe(reais(5000));
    const v = await cardView(card.id);
    expect(v).toMatchObject({ usedCents: reais(1760), availableCents: reais(3240), overLimit: false });
  });

  it("limite estourado: disponível 0 e overLimit", async () => {
    const { card, cat } = await setup();
    await buy(card.id, cat.id, 5200, "2026-09-06");
    expect(await cardView(card.id)).toMatchObject({ usedCents: reais(5200), availableCents: 0, overLimit: true });
  });

  it("editar valor, data e cartão recalcula a fatura; fatura vazia some", async () => {
    const { card, cat } = await setup();
    const t = await buy(card.id, cat.id, 100, "2026-09-06");
    await svc.transactions.update(t.id, { amountCents: reais(300) });
    expect((await svc.invoices.views())[0].totalCents).toBe(reais(300));
    const moved = await svc.transactions.update(t.id, { date: "2026-09-20" });
    expect(moved.invoiceId).toBe(`inv:${card.id}:2026-10`);
    const views = await svc.invoices.views();
    expect(views).toHaveLength(1); // a de setembro ficou vazia e foi removida
    expect(views[0].invoice.referenceKey).toBe("2026-10");
  });

  it("mudar de cartão para conta tira a compra da fatura e do limite", async () => {
    const { nu, card, cat } = await setup();
    const t = await buy(card.id, cat.id, 100, "2026-09-06");
    const updated = await svc.transactions.update(t.id, { cardId: undefined, accountId: nu.id });
    expect(updated.invoiceId).toBeUndefined();
    expect(await svc.invoices.list()).toHaveLength(0);
    expect(await balance(nu.id)).toBe(reais(4900));
  });

  it("excluir a única compra remove a fatura; excluir uma de várias mantém", async () => {
    const { card, cat } = await setup();
    const a = await buy(card.id, cat.id, 100, "2026-09-06");
    const b = await buy(card.id, cat.id, 50, "2026-09-07");
    await svc.transactions.remove(a.id);
    expect((await svc.invoices.views())[0].totalCents).toBe(reais(50));
    await svc.transactions.remove(b.id);
    expect(await svc.invoices.list()).toHaveLength(0);
  });

  it("fechar o cartão em outro dia não muda faturas já criadas", async () => {
    const { card, cat } = await setup();
    const t = await buy(card.id, cat.id, 100, "2026-09-06");
    await svc.cards.update(card.id, { closingDay: 5, dueDay: 10 });
    const inv = await svc.invoices.get(t.invoiceId!);
    expect(inv).toMatchObject({ closingDate: "2026-09-12", dueDate: "2026-09-19" });
    const edited = await svc.transactions.update(t.id, { description: "Outro nome" });
    expect(edited.invoiceId).toBe(t.invoiceId); // não pula de fatura só por editar o texto
    const novo = await buy(card.id, cat.id, 10, "2026-09-08"); // agora fecha dia 5 → vai para outubro
    expect(novo.invoiceId).toBe(`inv:${card.id}:2026-10`);
  });
});

describe("parcelas e fatura", () => {
  it("12x: a n-ésima parcela cai na n-ésima fatura (sem deslocar 2 vezes)", async () => {
    const { card, cat } = await setup();
    const parts = await svc.transactions.createInstallments({ type: "despesa", amountCents: reais(1200), description: "Notebook", date: "2026-09-06", cardId: card.id, categoryId: cat.id }, 12);
    expect(parts[0].invoiceId).toBe(`inv:${card.id}:2026-09`);
    expect(parts[11].invoiceId).toBe(`inv:${card.id}:2027-08`);
    const views = await svc.invoices.views({ today: "2026-09-10" });
    expect(views).toHaveLength(12);
    expect(views.every((v) => v.totalCents === reais(100))).toBe(true);
    expect((await cardView(card.id)).usedCents).toBe(reais(1200)); // limite usa o total
  });

  it("compra parcelada depois do fechamento começa na fatura seguinte", async () => {
    const { card, cat } = await setup();
    const parts = await svc.transactions.createInstallments({ type: "despesa", amountCents: reais(300), description: "x", date: "2026-09-20", cardId: card.id, categoryId: cat.id }, 3);
    expect(parts.map((p) => p.invoiceId!.slice(-7))).toEqual(["2026-10", "2026-11", "2026-12"]);
  });

  it("parcela não muda valor/data; excluir o grupo apaga as faturas que ficarem vazias", async () => {
    const { card, cat } = await setup();
    const parts = await svc.transactions.createInstallments({ type: "despesa", amountCents: reais(300), description: "x", date: "2026-09-06", cardId: card.id, categoryId: cat.id }, 3);
    await expect(svc.transactions.update(parts[0].id, { amountCents: 1 })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.transactions.update(parts[0].id, { date: "2026-09-07" })).rejects.toBeInstanceOf(ValidationError);
    await svc.transactions.update(parts[0].id, { description: "Renomeada" });
    await svc.transactions.removeInstallmentGroup(parts[0].installmentGroupId!);
    expect(await svc.invoices.list()).toHaveLength(0);
    expect(await svc.transactions.count()).toBe(0);
  });
});

describe("pagar fatura", () => {
  async function paid() {
    const ctx = await setup(1000);
    await buy(ctx.card.id, ctx.cat.id, 400, "2026-09-06");
    const [view] = await svc.invoices.views({ today: "2026-09-13" });
    return { ...ctx, invoiceId: view.invoice.id };
  }

  it("fatura aberta não pode ser paga", async () => {
    const { nu, card, cat } = await setup();
    await buy(card.id, cat.id, 100, "2026-09-06");
    const [v] = await svc.invoices.views({ today: "2026-09-10" });
    await expect(svc.invoices.pay(v.invoice.id, { accountId: nu.id, today: "2026-09-10" })).rejects.toThrow(/aberta/);
    expect(await balance(nu.id)).toBe(reais(5000));
  });

  it("paga: sai da conta, vira 'paga', libera o limite e NÃO vira despesa nova", async () => {
    const { nu, card, invoiceId } = await paid();
    const pay = await svc.invoices.pay(invoiceId, { accountId: nu.id, today: "2026-09-15" });
    expect(pay).toMatchObject({ type: "pagamento_fatura", amountCents: reais(400), accountId: nu.id, invoiceId, date: "2026-09-15" });
    expect(await balance(nu.id)).toBe(reais(600));
    expect((await svc.invoices.views({ today: "2026-09-16" }))[0]).toMatchObject({ status: "paga", paidDate: "2026-09-15", totalCents: reais(400) });
    expect((await cardView(card.id, "2026-09-16")).usedCents).toBe(0);
    expect((await svc.transactions.summarize()).expenseCents).toBe(reais(400)); // só a compra
  });

  it("estado 'paga' não vira 'atrasada' depois do vencimento", async () => {
    const { nu, invoiceId } = await paid();
    await svc.invoices.pay(invoiceId, { accountId: nu.id, today: "2026-09-15" });
    expect((await svc.invoices.views({ today: "2026-12-01" }))[0].status).toBe("paga");
  });

  it("não paga duas vezes", async () => {
    const { nu, invoiceId } = await paid();
    await svc.invoices.pay(invoiceId, { accountId: nu.id, today: "2026-09-15" });
    await expect(svc.invoices.pay(invoiceId, { accountId: nu.id, today: "2026-09-16" })).rejects.toBeInstanceOf(ValidationError);
    expect(await balance(nu.id)).toBe(reais(600));
  });

  it("saldo insuficiente: nada é gravado", async () => {
    const ctx = await setup(100);
    await buy(ctx.card.id, ctx.cat.id, 400, "2026-09-06");
    const [v] = await svc.invoices.views({ today: "2026-09-13" });
    await expect(svc.invoices.pay(v.invoice.id, { accountId: ctx.nu.id, today: "2026-09-13" })).rejects.toThrow(/Saldo insuficiente/);
    expect(await svc.transactions.count()).toBe(1);
    expect((await svc.invoices.views({ today: "2026-09-13" }))[0].status).toBe("fechada");
  });

  it("conta inexistente ou arquivada é recusada", async () => {
    const { nu, invoiceId } = await paid();
    await expect(svc.invoices.pay(invoiceId, { accountId: "fantasma", today: "2026-09-15" })).rejects.toBeInstanceOf(ValidationError);
    await svc.accounts.archive(nu.id);
    await expect(svc.invoices.pay(invoiceId, { accountId: nu.id, today: "2026-09-15" })).rejects.toBeInstanceOf(ValidationError);
  });

  it("fatura paga protege as compras: não edita valor, não exclui, não aceita compra nova no ciclo", async () => {
    const { nu, card, cat, invoiceId } = await paid();
    const [purchase] = await svc.invoices.purchases(invoiceId);
    await svc.invoices.pay(invoiceId, { accountId: nu.id, today: "2026-09-15" });
    await expect(svc.transactions.update(purchase.id, { amountCents: 1 })).rejects.toThrow(/fatura já paga/);
    await expect(svc.transactions.remove(purchase.id)).rejects.toThrow(/fatura já paga/);
    await expect(buy(card.id, cat.id, 10, "2026-09-08")).rejects.toThrow(/já foi paga/);
    await svc.transactions.update(purchase.id, { description: "só o texto" }); // permitido
    expect((await svc.transactions.get(purchase.id))!.description).toBe("só o texto");
    await expect(svc.invoices.remove(invoiceId)).rejects.toBeInstanceOf(InUseError);
  });

  it("desfazer o pagamento devolve o dinheiro e reabre a fatura", async () => {
    const { nu, card, invoiceId } = await paid();
    await svc.invoices.pay(invoiceId, { accountId: nu.id, today: "2026-09-15" });
    await svc.invoices.undoPayment(invoiceId);
    expect(await balance(nu.id)).toBe(reais(1000));
    expect((await svc.invoices.views({ today: "2026-09-16" }))[0].status).toBe("fechada");
    expect((await cardView(card.id, "2026-09-16")).usedCents).toBe(reais(400));
    expect(await svc.transactions.count()).toBe(1);
    await expect(svc.invoices.undoPayment(invoiceId)).rejects.toBeInstanceOf(ValidationError);
  });

  it("pagar uma fatura não mexe no limite de outro cartão", async () => {
    const ctx = await setup(2000);
    const other = await svc.cards.create({ name: "Inter", institution: "Inter", limitCents: reais(3000), closingDay: 12, dueDay: 19 });
    await buy(ctx.card.id, ctx.cat.id, 400, "2026-09-06");
    await buy(other.id, ctx.cat.id, 250, "2026-09-06");
    const v = (await svc.invoices.views({ today: "2026-09-13", cardId: ctx.card.id }))[0];
    await svc.invoices.pay(v.invoice.id, { accountId: ctx.nu.id, today: "2026-09-13" });
    expect((await cardView(other.id, "2026-09-16")).usedCents).toBe(reais(250));
    expect((await svc.accounts.overview()).cardUsedCents).toBe(reais(250));
  });
});

describe("cartões", () => {
  it("valida formato e conta de pagamento", async () => {
    const base = { name: "X", institution: "Y", limitCents: 100, closingDay: 5, dueDay: 12 };
    await expect(svc.cards.create({ ...base, name: " " })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.cards.create({ ...base, closingDay: 0 })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.cards.create({ ...base, dueDay: 32 })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.cards.create({ ...base, limitCents: -1 })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.cards.create({ ...base, limitCents: 10.5 })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.cards.create({ ...base, last4: "12" })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.cards.create({ ...base, defaultPaymentAccountId: "fantasma" })).rejects.toBeInstanceOf(ValidationError);
    expect(await svc.cards.list()).toHaveLength(0);
  });

  it("guarda o modelo escolhido (inclusive 'outro')", async () => {
    const c = await svc.cards.create({ name: "X", institution: "Banco Z", issuer: "outro", limitCents: 100, closingDay: 5, dueDay: 12 });
    expect((await svc.cards.get(c.id))!.issuer).toBe("outro");
  });

  it("com histórico só arquiva; sem histórico exclui; arquivado sai da lista mas não do histórico", async () => {
    const { card, cat } = await setup();
    const vazio = await svc.cards.create({ name: "Vazio", institution: "V", limitCents: 100, closingDay: 5, dueDay: 12 });
    await buy(card.id, cat.id, 10, "2026-09-06");
    await expect(svc.cards.remove(card.id)).rejects.toBeInstanceOf(InUseError);
    await svc.cards.remove(vazio.id);
    await svc.cards.archive(card.id);
    expect((await svc.cards.list()).map((c) => c.id)).toEqual([]);
    expect(await svc.cards.list({ includeArchived: true })).toHaveLength(1);
    await expect(buy(card.id, cat.id, 10, "2026-09-07")).rejects.toBeInstanceOf(ValidationError);
    await svc.cards.restore(card.id);
    expect(await svc.cards.list()).toHaveLength(1);
  });

  it("overview traz a fatura atual mesmo sem compras", async () => {
    const { card } = await setup();
    const v = await cardView(card.id, "2026-09-20");
    expect(v.nextInvoice).toMatchObject({ referenceKey: "2026-10", closingDate: "2026-10-12", dueDate: "2026-10-19", totalCents: 0 });
  });
});

describe("dados antigos e recorrências no cartão", () => {
  it("assignMissing liga compras antigas à fatura certa e é idempotente", async () => {
    const { card, cat } = await setup();
    const now = new Date().toISOString();
    await storage.repo("transactions").put({ id: "legacy", type: "despesa", amountCents: 5000, description: "antiga", date: "2026-08-20", cardId: card.id, categoryId: cat.id, createdAt: now, updatedAt: now });
    expect(await svc.invoices.assignMissing()).toBe(1);
    expect((await svc.transactions.get("legacy"))!.invoiceId).toBe(`inv:${card.id}:2026-09`);
    expect(await svc.invoices.assignMissing()).toBe(0);
    expect(await storage.repo("invoices").count()).toBe(1);
  });

  it("assinatura recorrente no cartão cai na fatura de cada mês", async () => {
    const { card, cat } = await setup();
    await svc.transactions.createRecurring({ type: "despesa", amountCents: reais(40), description: "Streaming", date: "2026-08-05", cardId: card.id, categoryId: cat.id }, "mensal");
    await svc.recurrences.generateDue({ today: "2026-10-20" });
    const views = await svc.invoices.views({ today: "2026-10-20" });
    expect(views.map((v) => [v.invoice.referenceKey, v.totalCents])).toEqual([["2026-10", reais(40)], ["2026-09", reais(40)], ["2026-08", reais(40)]]);
    expect((await cardView(card.id, "2026-10-20")).usedCents).toBe(reais(120));
  });
});
