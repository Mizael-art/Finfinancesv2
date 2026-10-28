import { describe, expect, it } from "vitest";
import type { Recurrence } from "@/types/domain";
import { billsInMonth, buildBillsView, reminderBills } from "./bills";

const stamp = { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
const rec = (o: Partial<Recurrence>): Recurrence => ({ id: "r1", ...stamp, type: "despesa", description: "Aluguel", amountCents: 120000, frequency: "mensal", dayOfMonth: 5, active: true, startDate: "2026-01-05", lastGeneratedDate: "2026-10-05", ...o });
const TODAY = "2026-10-27";

describe("billsInMonth", () => {
  it("cria um vencimento por mês e marca pago pelo dia exato", () => {
    const [b] = billsInMonth([rec({ paidDates: ["2026-10-05"] })], "2026-10", TODAY);
    expect(b).toMatchObject({ dueDate: "2026-10-05", paid: true, status: "paga" });
  });
  it("não pago e já vencido: atrasada; vence hoje: hoje; depois: pendente", () => {
    const list = billsInMonth([rec({ id: "a", dayOfMonth: 5 }), rec({ id: "b", dayOfMonth: 27 }), rec({ id: "c", dayOfMonth: 30 })], "2026-10", TODAY);
    expect(list.map((b) => b.status)).toEqual(["atrasada", "hoje", "pendente"]);
  });
  it("não cria vencimento antes do início da despesa", () => {
    expect(billsInMonth([rec({ startDate: "2026-10-20" })], "2026-10", TODAY)).toHaveLength(0);
    expect(billsInMonth([rec({ startDate: "2026-10-20" })], "2026-11", TODAY)).toHaveLength(1);
  });
  it("ignora pausada, receita, semanal e diária", () => {
    const list = billsInMonth([rec({ active: false }), rec({ type: "receita" }), rec({ frequency: "semanal" }), rec({ frequency: "diaria" })], "2026-10", TODAY);
    expect(list).toHaveLength(0);
  });
  it("anual aparece só no mês certo", () => {
    const r = rec({ frequency: "anual", startDate: "2025-03-10", dayOfMonth: 10 });
    expect(billsInMonth([r], "2026-03", TODAY)).toHaveLength(1);
    expect(billsInMonth([r], "2026-04", TODAY)).toHaveLength(0);
  });
});

describe("buildBillsView", () => {
  it("com tudo pago no mês atual, esconde o atual e segue para o próximo", () => {
    const v = buildBillsView([rec({ paidDates: ["2026-10-05"] })], TODAY);
    expect(v).toMatchObject({ showCurrent: false, currentPaidAll: true, pendingCount: 0, nextKey: "2026-11" });
    expect(v.next).toHaveLength(1);
  });
  it("com conta por pagar, mostra o mês atual e soma o que falta", () => {
    const v = buildBillsView([rec({}), rec({ id: "b", description: "Luz", dayOfMonth: 30, amountCents: 18000 })], TODAY);
    expect(v).toMatchObject({ showCurrent: true, pendingCount: 2, overdueCount: 1, pendingCents: 138000 });
  });
  it("virada de ano: o próximo mês de dezembro é janeiro", () => {
    expect(buildBillsView([], "2026-12-15").nextKey).toBe("2027-01");
  });
});

describe("reminderBills", () => {
  it("separa atrasadas e as que vencem em até 3 dias (inclusive no mês seguinte)", () => {
    const recs = [rec({ id: "a" }), rec({ id: "b", description: "Luz", dayOfMonth: 29 }), rec({ id: "c", description: "Internet", dayOfMonth: 1 }), rec({ id: "d", description: "Longe", dayOfMonth: 20 })];
    const r = reminderBills(recs, "2026-10-30");
    // Internet (dia 1) está atrasada em outubro e, ao mesmo tempo, vence de novo em 01/11 (dentro de 3 dias).
    expect(r.overdue.map((b) => b.recurrence.description).sort()).toEqual(["Aluguel", "Internet", "Longe", "Luz"]);
    expect(r.soon.map((b) => `${b.recurrence.description} ${b.dueDate}`)).toEqual(["Internet 2026-11-01"]);
  });
  it("conta paga não gera lembrete", () => {
    expect(reminderBills([rec({ paidDates: ["2026-10-05"] })], "2026-10-30").overdue).toHaveLength(0);
  });
});
