import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { newId } from "@/lib/id";
import { createIndexedDbStorage } from "@/storage/indexeddb";
import type { Storage } from "@/storage/types";
import { createServices, type Services } from "../index";
import { buildGoalItem, buildGoalItems, monthsUntil } from "./compute";

let storage: Storage;
let svc: Services;
beforeEach(() => { storage = createIndexedDbStorage(`goal-${newId()}`); svc = createServices(storage); });
afterEach(() => storage.close());
const reais = (n: number) => Math.round(n * 100);
const goal = (over = {}) => ({ id: "g", name: "Viagem", targetCents: 10000, currentCents: 0, createdAt: "", updatedAt: "", ...over }) as never;

describe("monthsUntil", () => {
  it("conta meses de calendário; parcial conta como um; mínimo 1", () => {
    expect(monthsUntil("2026-10-20", "2026-12-20")).toBe(2);
    expect(monthsUntil("2026-10-20", "2026-12-31")).toBe(3);
    expect(monthsUntil("2026-10-20", "2026-10-31")).toBe(1);
    expect(monthsUntil("2026-10-20", "2026-10-20")).toBe(1);
    expect(monthsUntil("2026-10-20", "2027-01-10")).toBe(3);
    expect(monthsUntil("2026-12-20", "2027-01-21")).toBe(2);
  });
});

describe("buildGoalItem", () => {
  it("progresso, restante e quanto guardar por mês (arredonda para cima)", () => {
    const i = buildGoalItem(goal({ targetCents: 10000, currentCents: 3333, deadline: "2026-12-20" }), "2026-10-20");
    expect(i).toMatchObject({ percent: 33, remainingCents: 6667, status: "andamento", monthsLeft: 2, monthlyNeededCents: 3334 });
  });
  it("concluída (inclusive passando da meta): barra em 100, restante 0, sem mensal", () => {
    const i = buildGoalItem(goal({ targetCents: 10000, currentCents: 12000, deadline: "2026-12-20" }), "2026-10-20");
    expect(i).toMatchObject({ percent: 100, remainingCents: 0, status: "concluida", monthlyNeededCents: null });
  });
  it("99,9% não vira 100 nem concluída", () => {
    expect(buildGoalItem(goal({ targetCents: 100000, currentCents: 99999 }), "2026-10-20")).toMatchObject({ percent: 99, status: "andamento" });
  });
  it("prazo vencido e não concluída = atrasada; prazo hoje ainda é andamento; sem prazo = sem mensal", () => {
    expect(buildGoalItem(goal({ deadline: "2026-10-19" }), "2026-10-20").status).toBe("atrasada");
    expect(buildGoalItem(goal({ deadline: "2026-10-20" }), "2026-10-20").status).toBe("andamento");
    expect(buildGoalItem(goal({}), "2026-10-20")).toMatchObject({ status: "andamento", monthlyNeededCents: null });
  });
  it("concluída com prazo vencido continua concluída", () => {
    expect(buildGoalItem(goal({ currentCents: 10000, deadline: "2020-01-01" }), "2026-10-20").status).toBe("concluida");
  });
});

describe("buildGoalItems (ordem)", () => {
  it("andamento por prazo (sem prazo no fim), depois atrasadas, depois concluídas", () => {
    const list = [
      goal({ id: "1", name: "Concluída", currentCents: 10000 }),
      goal({ id: "2", name: "Atrasada", deadline: "2026-01-01" }),
      goal({ id: "3", name: "Sem prazo" }),
      goal({ id: "4", name: "Longe", deadline: "2027-06-01" }),
      goal({ id: "5", name: "Perto", deadline: "2026-11-01" }),
    ];
    expect(buildGoalItems(list, "2026-10-20").map((i) => i.goal.name)).toEqual(["Perto", "Longe", "Sem prazo", "Atrasada", "Concluída"]);
  });
});

describe("goals service", () => {
  it("cria com valor já guardado, valida e normaliza cor", async () => {
    const g = await svc.goals.create({ name: " Moto ", targetCents: reais(15000), currentCents: reais(2100), deadline: "2027-06-30", color: "#2aa9f0" });
    expect(g).toMatchObject({ name: "Moto", currentCents: reais(2100), color: "#2AA9F0" });
    await expect(svc.goals.create({ name: "", targetCents: 100, currentCents: 0 })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.goals.create({ name: "x", targetCents: 0, currentCents: 0 })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.goals.create({ name: "x", targetCents: 100, currentCents: -1 })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.goals.create({ name: "x", targetCents: 100, currentCents: 0, color: "vermelho" })).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.goals.create({ name: "x", targetCents: 100, currentCents: 0, deadline: "31/12/2026" })).rejects.toBeInstanceOf(ValidationError);
  });
  it("aporte soma e retirada subtrai; retirar demais, zero ou meta inexistente é recusado sem alterar nada", async () => {
    const g = await svc.goals.create({ name: "Reserva", targetCents: reais(1000), currentCents: reais(100) });
    expect((await svc.goals.deposit(g.id, reais(50))).currentCents).toBe(reais(150));
    expect((await svc.goals.withdraw(g.id, reais(150))).currentCents).toBe(0);
    await expect(svc.goals.withdraw(g.id, 1)).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.goals.deposit(g.id, 0)).rejects.toBeInstanceOf(ValidationError);
    await expect(svc.goals.deposit("nada", 100)).rejects.toBeInstanceOf(ValidationError);
    expect((await svc.goals.get(g.id))!.currentCents).toBe(0);
  });
  it("retirar 1 centavo a mais do que existe é recusado; retirar exatamente tudo é aceito", async () => {
    const g = await svc.goals.create({ name: "R", targetCents: 1000, currentCents: 100 });
    await expect(svc.goals.withdraw(g.id, 101)).rejects.toThrow("mais do que está guardado");
    expect((await svc.goals.get(g.id))!.currentCents).toBe(100);
    expect((await svc.goals.withdraw(g.id, 100)).currentCents).toBe(0);
  });
  it("aporte e retirada não mexem em contas nem transações", async () => {
    const acc = await svc.accounts.create({ name: "Nu", type: "digital", initialBalanceCents: reais(1000) });
    const g = await svc.goals.create({ name: "R", targetCents: reais(500), currentCents: 0 });
    await svc.goals.deposit(g.id, reais(200));
    expect(await svc.transactions.list()).toHaveLength(0);
    expect((await svc.accounts.list()).find((a) => a.id === acc.id)!.initialBalanceCents).toBe(reais(1000));
  });
  it("editar mantém o guardado; overview totaliza e conta ativas/concluídas", async () => {
    const a = await svc.goals.create({ name: "A", targetCents: 1000, currentCents: 400 });
    await svc.goals.create({ name: "B", targetCents: 500, currentCents: 500 });
    await svc.goals.update(a.id, { name: "A2", targetCents: 2000 });
    const o = await svc.goals.overview("2026-10-20");
    expect(o).toMatchObject({ totalSavedCents: 900, activeCount: 1, doneCount: 1 });
    expect(o.items.find((i) => i.goal.id === a.id)!.goal).toMatchObject({ name: "A2", currentCents: 400 });
  });
  it("excluir meta remove só a meta", async () => {
    const g = await svc.goals.create({ name: "A", targetCents: 1000, currentCents: 0 });
    await svc.goals.remove(g.id);
    expect(await svc.goals.list()).toHaveLength(0);
  });
});
