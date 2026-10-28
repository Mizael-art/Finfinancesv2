import { describe, expect, it } from "vitest";
import type { Recurrence } from "@/types/domain";
import { groupByDueMonth, nextDueDate } from "./nextDue";

const stamp = { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
const rec = (o: Partial<Recurrence>): Recurrence => ({ id: "r1", ...stamp, type: "despesa", description: "Aluguel", amountCents: 100, frequency: "mensal", dayOfMonth: 5, active: true, startDate: "2026-01-05", lastGeneratedDate: "2026-10-05", ...o });

describe("nextDueDate", () => {
  it("conta já lançada neste mês: próximo vencimento é do mês seguinte", () => {
    expect(nextDueDate(rec({}), "2026-10-27")).toBe("2026-11-05");
  });
  it("conta que ainda vence neste mês", () => {
    expect(nextDueDate(rec({ dayOfMonth: 30, lastGeneratedDate: "2026-09-30" }), "2026-10-27")).toBe("2026-10-30");
  });
  it("pausada não tem próximo vencimento", () => {
    expect(nextDueDate(rec({ active: false }), "2026-10-27")).toBeUndefined();
  });
  it("encerrada não tem próximo vencimento", () => {
    expect(nextDueDate(rec({ endDate: "2026-10-31" }), "2026-10-27")).toBeUndefined();
  });
});

describe("groupByDueMonth", () => {
  it("agrupa por mês do vencimento e põe o mês mais próximo primeiro", () => {
    const a = { recurrence: rec({ id: "a", description: "Internet" }), next: "2026-11-15" };
    const b = { recurrence: rec({ id: "b", description: "Aluguel" }), next: "2026-11-05" };
    const c = { recurrence: rec({ id: "c", description: "Luz" }), next: "2026-10-30" };
    const groups = groupByDueMonth([a, b, c]);
    expect(groups.map((g) => g.key)).toEqual(["2026-10", "2026-11"]);
    expect(groups[1].items.map((i) => i.recurrence.description)).toEqual(["Aluguel", "Internet"]);
  });
});
