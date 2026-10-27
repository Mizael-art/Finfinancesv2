import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newId } from "@/lib/id";
import { createIndexedDbStorage } from "@/storage/indexeddb";
import type { Storage } from "@/storage/types";
import type { OnboardingDraft } from "@/types/domain";
import { createServices, type Services } from "../index";
import { activeFixedExpenses, activeIncomes, displayName, emptyDraft, greetingFor, hasErrors, validateAll, validateStep } from "./compute";

let storage: Storage;
let svc: Services;
beforeEach(() => { storage = createIndexedDbStorage(`onb-${newId()}`); svc = createServices(storage); });
afterEach(() => storage.close());
const R = (n: number) => Math.round(n * 100);
const draft = (over: Partial<OnboardingDraft> = {}): OnboardingDraft => ({ ...emptyDraft(), name: "João da Silva", ...over });

describe("validação", () => {
  it("só o nome é obrigatório", () => {
    expect(validateStep(1, emptyDraft()).name).toBeTruthy();
    expect(hasErrors(validateAll(draft({ incomeMode: "depois" })))).toBe(false);
  });
  it("renda: valor obrigatório se escolheu salário/variável; 'depois' dispensa", () => {
    expect(validateStep(2, draft({ incomeMode: "fixa" })).income).toBeTruthy();
    expect(validateStep(2, draft({ incomeMode: "depois" })).income).toBeUndefined();
    expect(validateStep(2, draft({ incomeMode: "fixa", incomes: [{ name: "Salário", amountCents: R(3000) }] }))).toEqual({});
    expect(validateStep(2, draft({ incomeMode: "varias", incomes: [{ name: "A", amountCents: 0 }, { name: "B", amountCents: 0 }] })).income).toBeTruthy();
    expect(validateStep(2, draft({ incomeMode: "depois", payDay: 40 })).payDay).toBeUndefined();
    expect(validateStep(2, draft({ incomeMode: "fixa", incomes: [{ name: "S", amountCents: 100 }], payDay: 32 })).payDay).toBeTruthy();
  });
  it("etapa opcional: o que for preenchido precisa ser válido", () => {
    expect(validateStep(4, draft({ accountBalanceCents: R(10) })).account).toBeTruthy();
    expect(validateStep(4, draft({ accountName: "Nubank", accountBalanceCents: R(10) }))).toEqual({});
    expect(validateStep(4, draft({ fixedExpenses: [{ name: "Aluguel", amountCents: 0, day: 5 }] })).fixed).toBeTruthy();
    expect(validateStep(4, draft({ fixedExpenses: [{ name: "", amountCents: 0, day: 5 }] }))).toEqual({}); // linha em branco é ignorada
  });
  it("apelido, saudação e linhas ativas", () => {
    expect(displayName(draft())).toBe("João");
    expect(displayName(draft({ nickname: "Jota" }))).toBe("Jota");
    expect(greetingFor(8)).toBe("Bom dia");
    expect(greetingFor(14)).toBe("Boa tarde");
    expect(greetingFor(22)).toBe("Boa noite");
    expect(greetingFor(3)).toBe("Boa noite");
    expect(activeIncomes(draft({ incomeMode: "varias", incomes: [{ name: "", amountCents: 100 }, { name: "x", amountCents: 0 }, { name: "Freela", amountCents: 50 }] })).map((i) => i.name)).toEqual(["Salário", "Freela"]);
    expect(activeFixedExpenses(draft({ fixedExpenses: [{ name: "", amountCents: 0, day: 1 }, { name: "Luz", amountCents: 1, day: 1 }] }))).toHaveLength(1);
  });
});

describe("concluir", () => {
  it("renda e saldo inicial NÃO viram transação nem saldo extra", async () => {
    await svc.onboarding.complete(draft({
      nickname: "Jota", incomeMode: "fixa", incomes: [{ name: "Salário", amountCents: R(5000) }], payDay: 5,
      goals: ["economizar", "investir"], accountName: "Nubank", accountBalanceCents: R(800), monthlyLimitCents: R(3000),
      fixedExpenses: [{ name: "Aluguel", amountCents: R(1200), day: 10 }],
    }));
    expect(await svc.transactions.count()).toBe(0);
    expect(await svc.accounts.getNetWorthCents()).toBe(R(800)); // só o saldo de abertura
    const s = await svc.settings.get();
    expect(s.onboardingCompleted).toBe(true);
    expect(s.financialGoals).toEqual(["economizar", "investir"]);
    expect(s.monthlyLimitCents).toBe(R(3000));
    expect(s.onboardingDraft).toBeUndefined();
    expect((await svc.users.getCurrent())?.nickname).toBe("Jota");
    const inc = await svc.income.list();
    expect(inc).toHaveLength(1);
    expect(inc[0]).toMatchObject({ amountCents: R(5000), isPrimary: true, kind: "fixa" });
    expect((await svc.categories.list()).some((c) => c.name === "Alimentação")).toBe(true);
    // gasto fixo vira repetição, sem lançar nada para trás
    expect((await svc.recurrences.list())).toHaveLength(1);
    await svc.recurrences.generateDue();
    expect(await svc.transactions.count()).toBe(0);
  });
  it("pode pular tudo menos o nome", async () => {
    await svc.onboarding.complete(draft({ incomeMode: "depois" }));
    expect(await svc.accounts.list()).toHaveLength(0);
    expect(await svc.income.list()).toHaveLength(0);
    expect((await svc.settings.get()).onboardingCompleted).toBe(true);
  });
  it("recusa dados inválidos sem gravar nada", async () => {
    await expect(svc.onboarding.complete(draft({ name: "" }))).rejects.toThrow();
    await expect(svc.onboarding.complete(draft({ incomeMode: "fixa" }))).rejects.toThrow();
    expect((await svc.settings.get()).onboardingCompleted).toBe(false);
    expect(await svc.users.getCurrent()).toBeUndefined();
  });
  it("concluir duas vezes não duplica conta, renda nem gasto fixo", async () => {
    const d = draft({ incomeMode: "fixa", incomes: [{ name: "Salário", amountCents: R(1000) }], accountName: "Nubank", accountBalanceCents: R(10), fixedExpenses: [{ name: "Luz", amountCents: R(100), day: 3 }] });
    await svc.onboarding.complete(d);
    await svc.onboarding.complete(d);
    expect(await svc.accounts.list()).toHaveLength(1);
    expect(await svc.income.list()).toHaveLength(1);
    expect(await svc.recurrences.list()).toHaveLength(1);
  });
});

describe("rascunho e edição", () => {
  it("retoma de onde parou", async () => {
    await svc.onboarding.saveDraft(draft({ step: 3, nickname: "Jota" }));
    const { draft: d, completed } = await svc.onboarding.load();
    expect(completed).toBe(false);
    expect(d).toMatchObject({ step: 3, name: "João da Silva", nickname: "Jota" });
  });
  it("o rascunho não vai para o backup e some ao concluir", async () => {
    await svc.onboarding.saveDraft(draft({ step: 2 }));
    expect(JSON.stringify((await svc.backup.snapshot()).data.settings)).not.toContain("onboardingDraft");
    await svc.onboarding.complete(draft({ incomeMode: "depois" }));
    expect((await svc.settings.get()).onboardingDraft).toBeUndefined();
    await svc.onboarding.saveDraft(draft({ step: 1 })); // já concluído: ignora
    expect((await svc.settings.get()).onboardingDraft).toBeUndefined();
  });
  it("editar depois atualiza sem duplicar nem apagar contas e transações", async () => {
    const nu = await svc.accounts.create({ name: "Nubank", type: "digital", initialBalanceCents: R(100) });
    await svc.onboarding.complete(draft({ incomeMode: "fixa", incomes: [{ name: "Salário", amountCents: R(1000) }] }));
    const { draft: d, completed } = await svc.onboarding.load();
    expect(completed).toBe(true);
    expect(d.incomes[0].amountCents).toBe(R(1000));
    await svc.onboarding.complete({ ...d, name: "João S.", incomes: [{ name: "Salário", amountCents: R(1500) }], accountName: "Outra", accountBalanceCents: R(5) }, "edit");
    expect((await svc.income.list())[0].amountCents).toBe(R(1500));
    expect(await svc.income.list()).toHaveLength(1);
    expect((await svc.accounts.list()).map((a) => a.id)).toEqual([nu.id]); // "edit" não cria conta
    expect((await svc.users.getCurrent())?.name).toBe("João S.");
  });
  it("salvar o perfil em Configurações mantém o apelido", async () => {
    await svc.users.save({ name: "João", nickname: "Jota" });
    await svc.users.save({ name: "João Silva", email: "j@e.com" });
    expect(await svc.users.getCurrent()).toMatchObject({ name: "João Silva", nickname: "Jota", email: "j@e.com" });
    await svc.users.save({ name: "João Silva", nickname: "" });
    expect((await svc.users.getCurrent())?.nickname).toBeUndefined();
  });
});
