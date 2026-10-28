import { describe, expect, it } from "vitest";
import type { IncomeSource, Recurrence, Transaction } from "@/types/domain";
import { buildPlan } from "./projection";

const stamp = { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
const rec = (o: Partial<Recurrence>): Recurrence => ({ id: "r1", ...stamp, type: "despesa", description: "Aluguel", amountCents: 120000, frequency: "mensal", dayOfMonth: 5, active: true, startDate: "2026-01-05", lastGeneratedDate: "2026-10-05", ...o });
const tx = (o: Partial<Transaction>): Transaction => ({ id: "t1", ...stamp, type: "despesa", amountCents: 1000, description: "Compra", date: "2026-11-10", ...o });
const income: IncomeSource = { id: "i1", ...stamp, name: "Salário", amountCents: 350000, payDay: 5, kind: "fixa", isPrimary: true };
const base = { today: "2026-10-27", months: 3, transactions: [], recurrences: [], incomes: [] };

describe("buildPlan", () => {
  it("cria um mês atual mais N meses", () => {
    expect(buildPlan(base).map((m) => m.key)).toEqual(["2026-10", "2026-11", "2026-12", "2027-01"]);
  });

  it("projeta despesa fixa mensal só a partir de hoje", () => {
    const plan = buildPlan({ ...base, recurrences: [rec({})] });
    expect(plan.map((m) => m.byGroup.fixa)).toEqual([0, 120000, 120000, 120000]);
    expect(plan[1].items[0]).toMatchObject({ group: "fixa", date: "2026-11-05", label: "Aluguel" });
  });

  it("ignora recorrência pausada", () => {
    expect(buildPlan({ ...base, recurrences: [rec({ active: false })] }).every((m) => m.expenseCents === 0)).toBe(true);
  });

  it("separa parcelas de outras despesas já lançadas e ignora o passado", () => {
    const plan = buildPlan({
      ...base,
      transactions: [
        tx({ id: "p2", installmentGroupId: "g", installmentNumber: 2, installmentTotal: 10, description: "Capacete", amountCents: 7900, date: "2026-11-13" }),
        tx({ id: "x", description: "Dentista", amountCents: 20000, date: "2026-11-20" }),
        tx({ id: "old", description: "Antiga", date: "2026-10-01" }),
        tx({ id: "tr", type: "transferencia", date: "2026-11-02" }),
      ],
    });
    expect(plan[1].byGroup).toMatchObject({ parcela: 7900, lancada: 20000 });
    expect(plan[1].items.find((i) => i.group === "parcela")?.label).toBe("Capacete (2/10)");
    expect(plan[0].expenseCents).toBe(0);
  });

  it("soma renda fixa por mês e calcula a sobra", () => {
    const plan = buildPlan({ ...base, incomes: [income, { ...income, id: "i2", kind: "variavel" }], recurrences: [rec({})] });
    expect(plan[1]).toMatchObject({ incomeCents: 350000, expenseCents: 120000, balanceCents: 230000 });
    expect(plan[0].incomeCents).toBe(0); // dia 5 de outubro já passou
  });

  it("não conta de novo o que já foi lançado (recorrência com última geração no futuro)", () => {
    const plan = buildPlan({ ...base, recurrences: [rec({ lastGeneratedDate: "2026-11-05" })], transactions: [tx({ date: "2026-11-05", amountCents: 120000, description: "Aluguel", recurrenceId: "r1" })] });
    expect(plan[1].byGroup.fixa + plan[1].byGroup.lancada).toBe(120000);
  });
});
