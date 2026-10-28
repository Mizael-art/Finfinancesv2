import { describe, expect, it } from "vitest";
import type { BudgetItem } from "@/services/budgets/compute";
import type { InvoiceView } from "@/services/invoices/compute";
import type { Recurrence } from "@/types/domain";
import { buildAlerts, type AlertInput } from "./alerts";

const stamp = { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
const rec = (o: Partial<Recurrence>): Recurrence => ({ id: "r1", ...stamp, type: "despesa", description: "Aluguel", amountCents: 120000, frequency: "mensal", dayOfMonth: 5, active: true, startDate: "2026-01-05", lastGeneratedDate: "2026-10-05", ...o });
const budget = (name: string, spent: number, limit: number, status: BudgetItem["status"]): BudgetItem => ({
  budget: { id: `b-${name}`, ...stamp, categoryId: `c-${name}`, limitCents: limit } as never, category: { id: `c-${name}`, name } as never,
  spentCents: spent, remainingCents: limit - spent, percent: Math.round((spent / limit) * 100), status,
});
const base: AlertInput = { today: "2026-10-27", recurrences: [], budgets: [], cards: [], invoices: [] };

describe("buildAlerts", () => {
  it("sem nada urgente: nenhum alerta e nenhum selo", () => {
    expect(buildAlerts({ ...base, recurrences: [rec({ paidDates: ["2026-10-05"] })] })).toEqual({ alerts: [], badge: 0 });
  });

  it("conta atrasada vem primeiro e conta no selo", () => {
    const r = buildAlerts({ ...base, recurrences: [rec({})], budgets: [budget("Lazer", 85, 100, "atencao")] });
    expect(r.alerts.map((a) => a.id)).toEqual(["contas-atrasadas", "orcamento-b-Lazer"]);
    expect(r.alerts[0]).toMatchObject({ severity: "alta", title: "Aluguel está atrasada", href: "/fixas" });
    expect(r.badge).toBe(1);
  });

  it("conta que vence amanhã", () => {
    const r = buildAlerts({ ...base, today: "2026-10-27", recurrences: [rec({ dayOfMonth: 28, paidDates: [], lastGeneratedDate: "2026-09-28" })] });
    expect(r.alerts[0]).toMatchObject({ id: "contas-vencendo", title: "Aluguel vence amanhã", severity: "media" });
  });

  it("orçamento estourado é alta; em atenção é média", () => {
    const r = buildAlerts({ ...base, budgets: [budget("Mercado", 120, 100, "estourado"), budget("Lazer", 85, 100, "atencao")] });
    expect(r.alerts.map((a) => [a.title, a.severity])).toEqual([["Orçamento de Mercado estourou", "alta"], ["Orçamento de Lazer em 85%", "media"]]);
  });

  it("fatura fechada perto do vencimento e fatura atrasada", () => {
    const inv = (id: string, status: InvoiceView["status"], dueDate: string): InvoiceView => ({ invoice: { id, dueDate } as never, cardId: "c", cardName: "Nubank", totalCents: 50000, purchaseCount: 3, status });
    const r = buildAlerts({ ...base, invoices: [inv("a", "fechada", "2026-10-30"), inv("b", "atrasada", "2026-10-10"), inv("c", "fechada", "2026-12-10"), inv("d", "paga", "2026-10-28")] });
    expect(r.alerts.map((a) => a.id)).toEqual(["fatura-b", "fatura-a"]);
    expect(r.badge).toBe(2);
  });

  it("limite do cartão em 80% e acima de 100%", () => {
    const r = buildAlerts({ ...base, cards: [{ id: "1", name: "Nubank", limitCents: 100000, usedCents: 85000 }, { id: "2", name: "Inter", limitCents: 100000, usedCents: 120000 }, { id: "3", name: "XP", limitCents: 100000, usedCents: 10000 }] });
    expect(r.alerts.map((a) => [a.id, a.severity])).toEqual([["limite-2", "alta"], ["limite-1", "media"]]);
  });

  it("avisa quando a sobra prevista de um mês fica negativa", () => {
    const plan = [{ key: "2026-12", items: [], variableCents: 0, incomeCents: 300000, expenseCents: 400000, balanceCents: -100000, byGroup: { fixa: 400000, parcela: 0, lancada: 0, renda: 300000 } }];
    expect(buildAlerts({ ...base, plan }).alerts[0]).toMatchObject({ id: "planejamento-negativo", href: "/planejamento" });
  });
});

import { bestPurchaseDay } from "@/features/cards/viewModels";

describe("bestPurchaseDay", () => {
  it("é o dia seguinte ao fechamento", () => {
    expect(bestPurchaseDay(5)).toBe(6);
    expect(bestPurchaseDay(28)).toBe(29);
    expect(bestPurchaseDay(31)).toBe(1);
  });
});
