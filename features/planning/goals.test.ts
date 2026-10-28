import { describe, expect, it } from "vitest";
import type { Goal } from "@/types/domain";
import { averageFreeCents, firstNegativeMonth, goalHints } from "./goals";
import type { PlanMonth } from "./projection";

const stamp = { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
const goal = (o: Partial<Goal>): Goal => ({ id: "g1", ...stamp, name: "Viagem", targetCents: 600000, currentCents: 0, ...o });
const month = (key: string, income: number, expense: number): PlanMonth => ({ key, items: [], variableCents: 0, incomeCents: income, expenseCents: expense, balanceCents: income - expense, byGroup: { fixa: expense, parcela: 0, lancada: 0, renda: income } });
const TODAY = "2026-10-27";

describe("goalHints", () => {
  it("meta com prazo: cabe na sobra média?", () => {
    const [h] = goalHints([goal({ deadline: "2027-04-27" })], 150000, TODAY);
    expect(h).toMatchObject({ kind: "prazo", needPerMonthCents: 100000, fits: true });
    const [h2] = goalHints([goal({ deadline: "2027-04-27" })], 50000, TODAY);
    expect(h2.fits).toBe(false);
  });
  it("meta sem prazo: estima em quantos meses termina", () => {
    expect(goalHints([goal({})], 200000, TODAY)[0]).toMatchObject({ kind: "ritmo", monthsToFinish: 3 });
    expect(goalHints([goal({})], -1000, TODAY)[0].monthsToFinish).toBeNull();
  });
  it("ignora meta concluída e meta atrasada; sem sobra calculável não opina", () => {
    expect(goalHints([goal({ currentCents: 600000 }), goal({ id: "g2", deadline: "2026-01-01" })], 100000, TODAY)).toHaveLength(0);
    expect(goalHints([goal({})], undefined, TODAY)).toHaveLength(0);
  });
});

describe("sobra e meses negativos", () => {
  const plan = [month("2026-11", 300000, 200000), month("2026-12", 300000, 400000), month("2027-01", 0, 100000)];
  it("média só dos meses com receita", () => expect(averageFreeCents(plan)).toBe(0));
  it("primeiro mês negativo com receita prevista", () => expect(firstNegativeMonth(plan)?.key).toBe("2026-12"));
  it("sem receita cadastrada não alerta", () => expect(firstNegativeMonth([month("2026-11", 0, 100000)])).toBeUndefined());
});
