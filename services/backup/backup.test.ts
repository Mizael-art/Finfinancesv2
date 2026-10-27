import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newId } from "@/lib/id";
import { createIndexedDbStorage } from "@/storage/indexeddb";
import type { Storage } from "@/storage/types";
import { createServices, type Services } from "../index";
import { inspectBackup, MAX_BACKUP_BYTES, type BackupFile } from "./index";

let storage: Storage;
let svc: Services;
const open = () => { storage = createIndexedDbStorage(`bkp-${newId()}`); svc = createServices(storage); };
beforeEach(open);
afterEach(() => storage.close());
const reais = (n: number) => Math.round(n * 100);

async function populate(s: Services) {
  await s.users.save({ name: "Marina", email: "m@e.com" });
  await s.settings.update({ onboardingCompleted: true, firstDayOfMonth: 5 });
  await s.categories.seedDefaults();
  const cats = await s.categories.list();
  const food = cats.find((c) => c.name === "Alimentação")!;
  const nu = await s.accounts.create({ name: "Nubank", type: "digital", initialBalanceCents: reais(1000) });
  const card = await s.cards.create({ name: "Nu", institution: "Nubank", limitCents: reais(3000), closingDay: 12, dueDay: 19 });
  await s.transactions.create({ type: "despesa", amountCents: reais(50), description: "Mercado", date: "2026-10-05", accountId: nu.id, categoryId: food.id });
  await s.transactions.createInstallments({ type: "despesa", amountCents: reais(300), description: "Notebook", date: "2026-10-05", cardId: card.id, categoryId: food.id }, 3);
  await s.budgets.create({ categoryId: food.id, limitCents: reais(500), period: "monthly" });
  await s.goals.create({ name: "Viagem", targetCents: reais(1000), currentCents: reais(100) });
  return { nu, card, food };
}
const roundTrip = async (): Promise<BackupFile> => {
  const text = JSON.stringify(await svc.backup.snapshot());
  const r = inspectBackup(text);
  if (!r.ok) throw new Error(r.error);
  return r.file;
};

describe("exportação", () => {
  it("gera snapshot completo, com contagens, sem o estado do Google", async () => {
    await populate(svc);
    await svc.settings.update({ backup: { googleConnected: true, autoBackup: true, lastBackupAt: "2026-10-01T00:00:00.000Z" } });
    const snap = await svc.backup.snapshot();
    expect(snap).toMatchObject({ app: "FinFinance", format: 1 });
    expect(snap.counts).toMatchObject({ users: 1, settings: 1, accounts: 1, cards: 1, transactions: 4, budgets: 1, goals: 1 });
    expect(snap.counts.invoices).toBeGreaterThan(0);
    expect(snap.data.settings[0]).not.toHaveProperty("backup");
    expect(JSON.stringify(snap)).not.toContain("lastBackupAt");
    expect(snap.data.settings[0]).toMatchObject({ firstDayOfMonth: 5, onboardingCompleted: true });
  });
  it("banco vazio exporta e reimporta sem erro", async () => {
    const r = inspectBackup(JSON.stringify(await svc.backup.snapshot()));
    expect(r.ok).toBe(true);
  });
  it("markExported só registra a exportação local", async () => {
    await svc.settings.update({ onboardingCompleted: true });
    await svc.backup.markExported();
    const b = (await svc.settings.get()).backup;
    expect(b.lastExportAt).toBeTruthy();
    expect(b.lastBackupAt).toBeUndefined();
  });
});

describe("restauração", () => {
  it("exporta de um aparelho e restaura idêntico em outro (ida e volta)", async () => {
    await populate(svc);
    const file = await roundTrip();
    storage.close(); open();
    await populate(svc); // dados diferentes no destino (ids novos)
    const counts = await svc.backup.restore(file);
    expect(counts).toEqual(file.counts);
    const again = await svc.backup.snapshot();
    expect({ ...again, exportedAt: "" }).toEqual({ ...file, exportedAt: "" });
  });
  it("substitui por completo: o que não está no backup some, o que está volta", async () => {
    const { nu } = await populate(svc);
    const file = await roundTrip();
    await svc.transactions.create({ type: "despesa", amountCents: 100, description: "Depois do backup", date: "2026-10-06", accountId: nu.id });
    await svc.accounts.create({ name: "Conta extra", type: "carteira", initialBalanceCents: 0 });
    await svc.backup.restore(file);
    expect((await svc.transactions.list()).some((t) => t.description === "Depois do backup")).toBe(false);
    expect((await svc.accounts.list()).map((a) => a.name)).toEqual(["Nubank"]);
    expect(await svc.transactions.count()).toBe(4);
  });
  it("valores derivados continuam certos depois de restaurar (saldo, patrimônio e faturas)", async () => {
    await populate(svc);
    const bal = async () => (await svc.accounts.listWithBalances()).map((a) => [a.name, a.balanceCents]);
    const invs = async () => (await svc.invoices.views({ today: "2026-10-20" })).map((v) => [v.invoice.referenceKey, v.totalCents]);
    const [b0, i0] = [await bal(), await invs()];
    const file = await roundTrip();
    storage.close(); open();
    await svc.backup.restore(file);
    expect(await bal()).toEqual(b0);
    expect(await invs()).toEqual(i0);
    expect(i0.length).toBeGreaterThan(0);
  });
  it("mantém o estado de backup/Google do aparelho, mesmo que o arquivo venha de outro", async () => {
    await populate(svc);
    const file = await roundTrip();
    await svc.settings.update({ backup: { googleConnected: true, autoBackup: true, lastBackupAt: "2026-10-20T00:00:00.000Z" } });
    await svc.backup.restore(file);
    expect((await svc.settings.get()).backup).toMatchObject({ googleConnected: true, autoBackup: true, lastBackupAt: "2026-10-20T00:00:00.000Z" });
    expect((await svc.settings.get()).firstDayOfMonth).toBe(5);
  });
  it("aparelho novo: configurações restauradas já nascem com o estado de backup padrão", async () => {
    await populate(svc);
    const file = await roundTrip();
    storage.close(); open();
    await svc.backup.restore(file);
    expect((await storage.repo("settings").get("settings"))!.backup).toEqual({ googleConnected: false, autoBackup: false, pending: false });
  });
  it("arquivo sem registro de configurações não apaga as configurações locais", async () => {
    await populate(svc);
    const file = await roundTrip();
    file.data.settings = [];
    await svc.backup.restore(file);
    expect((await svc.settings.get()).onboardingCompleted).toBe(true);
  });
  it("é atômica: se uma gravação falha no meio, nada muda", async () => {
    await populate(svc);
    const file = await roundTrip();
    const countBefore = await svc.transactions.count();
    await svc.accounts.create({ name: "Local", type: "carteira", initialBalanceCents: 0 });
    // registro que o IndexedDB não consegue clonar (função) derruba a transação inteira
    (file.data.goals[0] as unknown as Record<string, unknown>).boom = () => 1;
    await expect(svc.backup.restore(file)).rejects.toBeTruthy();
    expect((await svc.accounts.list()).map((a) => a.name).sort()).toEqual(["Local", "Nubank"]);
    expect(await svc.transactions.count()).toBe(countBefore);
  });
  it("notifica a interface (subscribe) ao restaurar", async () => {
    await populate(svc);
    const file = await roundTrip();
    let stores: string[] = [];
    svc.subscribe((e) => { stores = [...stores, ...e.stores]; });
    await svc.backup.restore(file);
    expect(stores).toContain("transactions");
  });
  it("recusa arquivo de formato mais novo", async () => {
    const file = await roundTrip();
    await expect(svc.backup.restore({ ...file, format: 99 })).rejects.toThrow();
  });
});

describe("validação do arquivo (nunca toca no banco)", () => {
  const good = async () => JSON.parse(JSON.stringify(await (async () => { await populate(svc); return svc.backup.snapshot(); })()));
  const err = (r: ReturnType<typeof inspectBackup>) => (r.ok ? "" : r.error);

  it("recusa lixo, JSON de outro app, arquivo vazio e arrays", () => {
    expect(err(inspectBackup("não é json"))).toContain("JSON válido");
    expect(err(inspectBackup(""))).toContain("JSON válido");
    expect(err(inspectBackup("[]"))).toContain("não parece ser um backup");
    expect(err(inspectBackup(JSON.stringify({ app: "Outro", format: 1, data: {} })))).toContain("não parece ser um backup");
    expect(err(inspectBackup("null"))).toContain("não parece ser um backup");
  });
  it("recusa arquivo grande demais sem nem tentar ler", () => {
    expect(err(inspectBackup("{}", { bytes: MAX_BACKUP_BYTES + 1 }))).toContain("grande demais");
  });
  it("recusa versão do formato ausente ou mais nova", async () => {
    const g = await good();
    expect(err(inspectBackup(JSON.stringify({ ...g, format: undefined })))).toContain("versão do formato");
    expect(err(inspectBackup(JSON.stringify({ ...g, format: 2 })))).toContain("mais nova");
  });
  it("recusa quando faltam stores ou o formato delas está errado", async () => {
    const g = await good();
    delete g.data.transactions;
    expect(err(inspectBackup(JSON.stringify(g)))).toContain("Transações: faltam");
    storage.close(); open();
    const h = await good(); h.data.accounts = {};
    expect(err(inspectBackup(JSON.stringify(h)))).toContain("Contas: formato inválido");
    expect(err(inspectBackup(JSON.stringify({ app: "FinFinance", format: 1 })))).toContain("não contém dados");
  });
  it.each([
    ["valor negativo", (g: any) => { g.data.transactions[0].amountCents = -5; }, "valor"],
    ["valor zero", (g: any) => { g.data.transactions[0].amountCents = 0; }, "valor"],
    ["valor decimal", (g: any) => { g.data.transactions[0].amountCents = 10.5; }, "valor"],
    ["valor em texto", (g: any) => { g.data.transactions[0].amountCents = "100"; }, "valor"],
    ["data impossível", (g: any) => { g.data.transactions[0].date = "2026-02-31"; }, "data"],
    ["tipo desconhecido", (g: any) => { g.data.transactions[0].type = "pix"; }, "tipo"],
    ["sem id", (g: any) => { delete g.data.accounts[0].id; }, "sem identificador"],
    ["id repetido", (g: any) => { g.data.categories[1].id = g.data.categories[0].id; }, "repetido"],
    ["sem datas de controle", (g: any) => { delete g.data.goals[0].createdAt; }, "datas de controle"],
    ["registro que não é objeto", (g: any) => { g.data.budgets[0] = 7; }, "registro inválido"],
    ["limite do cartão negativo", (g: any) => { g.data.cards[0].limitCents = -1; }, "limite"],
    ["dia de vencimento 40", (g: any) => { g.data.cards[0].dueDay = 40; }, "vencimento"],
    ["categoria sem tipo", (g: any) => { delete g.data.categories[0].kind; }, "tipo"],
    ["primeiro dia do mês 31", (g: any) => { g.data.settings[0].firstDayOfMonth = 31; }, "primeiro dia"],
    ["meta zerada", (g: any) => { g.data.goals[0].targetCents = 0; }, "valor da meta"],
    ["duas configurações", (g: any) => { g.data.settings.push({ ...g.data.settings[0], id: "settings" }); }, "repetido"],
  ])("recusa %s", async (_n, mutate, expected) => {
    const g = await good();
    mutate(g);
    const e = err(inspectBackup(JSON.stringify(g)));
    expect(e).toContain("corrompido");
    expect(e).toContain(expected);
  });
  it("aceita arquivo bom, com campos extras de versões futuras, e avisa sobre vínculos quebrados", async () => {
    const g = await good();
    g.data.accounts[0].campoNovo = "ok";
    g.data.transactions[0].accountId = "conta-que-nao-existe";
    const r = inspectBackup(JSON.stringify(g));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.warnings[0]).toContain("vínculo");
      expect(r.counts.transactions).toBe(4);
    }
  });
  it("a mensagem de erro não vaza valores do arquivo", async () => {
    const g = await good();
    g.data.transactions[0].amountCents = -98765;
    expect(err(inspectBackup(JSON.stringify(g)))).not.toContain("98765");
  });
});
