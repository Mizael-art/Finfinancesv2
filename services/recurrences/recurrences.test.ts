import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { newId } from "@/lib/id";
import { createIndexedDbStorage } from "@/storage/indexeddb";
import type { Storage } from "@/storage/types";
import type { Recurrence } from "@/types/domain";
import { createServices, type Services } from "../index";
import { MAX_PER_RUN, nextOccurrence, occurrencesUpTo } from "./schedule";

const base = { dayOfMonth: 5, startDate: "2026-01-01" } as const;

describe("occurrencesUpTo (calendário)", () => {
  it("mensal no dia 31: fevereiro e meses de 30 dias caem no último dia", () => {
    expect(occurrencesUpTo({ frequency: "mensal", dayOfMonth: 31, startDate: "2026-01-31" }, "2026-05-31")).toEqual([
      "2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31",
    ]);
    expect(occurrencesUpTo({ frequency: "mensal", dayOfMonth: 31, startDate: "2028-01-31" }, "2028-03-01")).toEqual(["2028-01-31", "2028-02-29"]);
  });

  it("mensal NÃO gera o mês de início se o dia já passou (gasto fixo cadastrado dia 29 com vencimento dia 5)", () => {
    expect(occurrencesUpTo({ frequency: "mensal", dayOfMonth: 5, startDate: "2026-09-29" }, "2026-12-31")).toEqual(["2026-10-05", "2026-11-05", "2026-12-05"]);
  });

  it("mensal atravessa a virada de ano", () => {
    expect(occurrencesUpTo({ frequency: "mensal", dayOfMonth: 15, startDate: "2026-11-15" }, "2027-02-20")).toEqual(["2026-11-15", "2026-12-15", "2027-01-15", "2027-02-15"]);
  });

  it("anual: 29/02 vira 28/02 nos anos comuns", () => {
    expect(occurrencesUpTo({ frequency: "anual", dayOfMonth: 29, startDate: "2024-02-29" }, "2028-12-31")).toEqual([
      "2024-02-29", "2025-02-28", "2026-02-28", "2027-02-28", "2028-02-29",
    ]);
  });

  it("semanal e diária", () => {
    expect(occurrencesUpTo({ ...base, frequency: "semanal", startDate: "2026-09-01" }, "2026-09-22")).toEqual(["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22"]);
    expect(occurrencesUpTo({ ...base, frequency: "diaria", startDate: "2026-09-29" }, "2026-10-02")).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  });

  it("respeita data final, ignora o que já foi gerado e não antecipa o futuro", () => {
    const r = { ...base, frequency: "mensal" as const };
    expect(occurrencesUpTo({ ...r, endDate: "2026-03-10" }, "2026-12-31")).toEqual(["2026-01-05", "2026-02-05", "2026-03-05"]);
    expect(occurrencesUpTo({ ...r, lastGeneratedDate: "2026-02-05" }, "2026-04-30")).toEqual(["2026-03-05", "2026-04-05"]);
    expect(occurrencesUpTo(r, "2025-12-31")).toEqual([]);
    expect(occurrencesUpTo(r, "2026-01-04")).toEqual([]); // dia 5 ainda não chegou
  });

  it("limita a quantidade por execução e continua de onde parou", () => {
    const daily = { ...base, frequency: "diaria" as const, startDate: "2020-01-01" };
    const first = occurrencesUpTo(daily, "2026-01-01");
    expect(first).toHaveLength(MAX_PER_RUN);
    expect(first[0]).toBe("2020-01-01");
    const next = occurrencesUpTo({ ...daily, lastGeneratedDate: first.at(-1) }, "2026-01-01");
    expect(next[0] > first.at(-1)!).toBe(true);
  });

  it("nextOccurrence", () => {
    expect(nextOccurrence("diaria", "2026-09-29")).toBe("2026-09-30");
    expect(nextOccurrence("semanal", "2026-09-29")).toBe("2026-10-06");
    expect(nextOccurrence("mensal", "2026-01-31")).toBe("2026-02-28");
    expect(nextOccurrence("anual", "2028-02-29")).toBe("2029-02-28");
  });
});

// ============================================================================
let storage: Storage;
let svc: Services;
beforeEach(() => {
  storage = createIndexedDbStorage(`rec-${newId()}`);
  svc = createServices(storage);
});
afterEach(() => storage.close());

const reais = (n: number) => Math.round(n * 100);
async function setup() {
  await svc.categories.seedDefaults();
  const cats = await svc.categories.list("despesa");
  const nu = await svc.accounts.create({ name: "Nubank", type: "digital", initialBalanceCents: reais(10000) });
  return { nu, moradia: cats.find((c) => c.name === "Moradia")!, assin: cats.find((c) => c.name === "Assinaturas")! };
}
const rent = (over: Partial<Recurrence> & Pick<Recurrence, "categoryId">) => ({
  type: "despesa" as const, description: "Aluguel", amountCents: reais(1500), frequency: "mensal" as const,
  dayOfMonth: 5, active: true, startDate: "2026-07-01", ...over,
});
const balance = async (id: string) => (await svc.accounts.listWithBalances()).find((a) => a.id === id)!.balanceCents;

describe("recurrences.generateDue", () => {
  it("lança as ocorrências vencidas, desconta da conta e guarda até onde gerou", async () => {
    const { nu, moradia } = await setup();
    const rec = await svc.recurrences.create(rent({ categoryId: moradia.id, accountId: nu.id }));
    expect(await svc.recurrences.generateDue({ today: "2026-09-29" })).toEqual({ created: 3, skipped: 0 });
    const txs = (await svc.transactions.list()).reverse();
    expect(txs.map((t) => t.date)).toEqual(["2026-07-05", "2026-08-05", "2026-09-05"]);
    expect(txs[0]).toMatchObject({ type: "despesa", amountCents: reais(1500), description: "Aluguel", categoryId: moradia.id, accountId: nu.id, recurrenceId: rec.id });
    expect(await balance(nu.id)).toBe(reais(10000 - 4500));
    expect((await svc.recurrences.get(rec.id))!.lastGeneratedDate).toBe("2026-09-05");
  });

  it("é idempotente: rodar de novo (ou duas abas) não duplica", async () => {
    const { nu, moradia } = await setup();
    await svc.recurrences.create(rent({ categoryId: moradia.id, accountId: nu.id }));
    await svc.recurrences.generateDue({ today: "2026-09-29" });
    expect(await svc.recurrences.generateDue({ today: "2026-09-29" })).toEqual({ created: 0, skipped: 0 });
    // simula outra aba que leu a repetição ANTES de gravar: sem lastGeneratedDate, mas as transações existem
    const rec = (await svc.recurrences.list())[0];
    await storage.repo("recurrences").put({ ...rec, lastGeneratedDate: undefined });
    expect((await svc.recurrences.generateDue({ today: "2026-09-29" })).created).toBe(0);
    expect(await svc.transactions.list()).toHaveLength(3);
  });

  it("recupera os meses em que o app ficou fechado e segue no mês seguinte", async () => {
    const { nu, moradia } = await setup();
    await svc.recurrences.create(rent({ categoryId: moradia.id, accountId: nu.id, startDate: "2026-01-01" }));
    expect((await svc.recurrences.generateDue({ today: "2026-09-29" })).created).toBe(9);
    expect((await svc.recurrences.generateDue({ today: "2026-10-04" })).created).toBe(0);
    expect((await svc.recurrences.generateDue({ today: "2026-10-05" })).created).toBe(1);
  });

  it("não gera nada antes da data de início (gasto cadastrado depois do vencimento do mês)", async () => {
    const { nu, moradia } = await setup();
    await svc.recurrences.create(rent({ categoryId: moradia.id, accountId: nu.id, startDate: "2026-09-29" }));
    expect((await svc.recurrences.generateDue({ today: "2026-09-30" })).created).toBe(0);
    expect((await svc.recurrences.generateDue({ today: "2026-10-05" })).created).toBe(1);
  });

  it("pula repetições inativas ou encerradas", async () => {
    const { nu, moradia } = await setup();
    await svc.recurrences.create(rent({ categoryId: moradia.id, accountId: nu.id, active: false }));
    await svc.recurrences.create(rent({ categoryId: moradia.id, accountId: nu.id, description: "Antigo", endDate: "2026-07-31" }));
    expect((await svc.recurrences.generateDue({ today: "2026-09-29" })).created).toBe(1); // só jul/05 do encerrado
  });

  it("gasto fixo sem conta usa a conta ativa mais antiga", async () => {
    const { nu, moradia } = await setup();
    await svc.accounts.create({ name: "Inter", type: "digital", initialBalanceCents: 0 });
    await svc.recurrences.create(rent({ categoryId: moradia.id }));
    await svc.recurrences.generateDue({ today: "2026-07-31" });
    expect((await svc.transactions.list())[0].accountId).toBe(nu.id);
  });

  it("sem nenhuma conta nada é gerado e a repetição espera (não perde os meses)", async () => {
    await svc.categories.seedDefaults();
    const moradia = (await svc.categories.list("despesa")).find((c) => c.name === "Moradia")!;
    const rec = await svc.recurrences.create(rent({ categoryId: moradia.id }));
    expect(await svc.recurrences.generateDue({ today: "2026-09-29" })).toEqual({ created: 0, skipped: 3 });
    expect((await svc.recurrences.get(rec.id))!.lastGeneratedDate).toBeUndefined();
    const nu = await svc.accounts.create({ name: "Nubank", type: "digital", initialBalanceCents: 0 });
    expect((await svc.recurrences.generateDue({ today: "2026-09-29" })).created).toBe(3);
    expect((await svc.transactions.list())[0].accountId).toBe(nu.id);
  });

  it("uma repetição quebrada não impede as outras", async () => {
    const { nu, moradia, assin } = await setup();
    await svc.recurrences.create(rent({ categoryId: assin.id, accountId: nu.id, description: "Netflix", amountCents: reais(39.9) }));
    const bad = await svc.recurrences.create(rent({ categoryId: moradia.id, accountId: nu.id, description: "Quebrada" }));
    await svc.categories.update(moradia.id, { kind: "receita" }); // categoria passa a não servir para despesa
    const res = await svc.recurrences.generateDue({ today: "2026-07-31" });
    expect(res.created).toBe(1);
    expect(res.skipped).toBe(1);
    expect((await svc.transactions.list())[0].description).toBe("Netflix");
    expect((await svc.recurrences.get(bad.id))!.lastGeneratedDate).toBeUndefined();
  });

  it("transação apagada não volta (a repetição já passou daquela data)", async () => {
    const { nu, moradia } = await setup();
    await svc.recurrences.create(rent({ categoryId: moradia.id, accountId: nu.id }));
    await svc.recurrences.generateDue({ today: "2026-09-29" });
    const aug = (await svc.transactions.list()).find((t) => t.date === "2026-08-05")!;
    await svc.transactions.remove(aug.id);
    await svc.recurrences.generateDue({ today: "2026-09-29" });
    expect(await svc.transactions.list()).toHaveLength(2);
  });

  it("repetição no cartão vira compra no cartão (não mexe no saldo da conta)", async () => {
    const { nu, assin } = await setup();
    const card = await svc.cards.create({ name: "Nu", institution: "Nubank", limitCents: reais(5000), closingDay: 12, dueDay: 19 });
    await svc.recurrences.create(rent({ categoryId: assin.id, cardId: card.id, description: "Netflix", amountCents: reais(39.9), dayOfMonth: 15 }));
    await svc.recurrences.generateDue({ today: "2026-08-20" });
    const txs = await svc.transactions.list();
    expect(txs.map((t) => [t.cardId, t.accountId])).toEqual([[card.id, undefined], [card.id, undefined]]);
    expect(await balance(nu.id)).toBe(reais(10000));
  });

  it("receitas recorrentes entram na conta", async () => {
    const { nu } = await setup();
    const salario = (await svc.categories.list("receita")).find((c) => c.name === "Salário")!;
    await svc.recurrences.create({ type: "receita", description: "Salário", amountCents: reais(5000), categoryId: salario.id, accountId: nu.id, frequency: "mensal", dayOfMonth: 5, active: true, startDate: "2026-08-01" });
    await svc.recurrences.generateDue({ today: "2026-09-29" });
    expect(await balance(nu.id)).toBe(reais(10000 + 10000));
  });
});
