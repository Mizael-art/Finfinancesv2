import { describe, expect, it } from "vitest";
import type { InvoiceView } from "@/services/invoices/compute";
import type { Recurrence } from "@/types/domain";
import { buildUpcoming } from "./upcoming";

const stamp = { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
const rec = (o: Partial<Recurrence>): Recurrence => ({ id: "r1", ...stamp, type: "despesa", description: "Aluguel", amountCents: 120000, frequency: "mensal", dayOfMonth: 5, active: true, startDate: "2026-01-05", lastGeneratedDate: "2026-10-05", ...o });
const inv = (id: string, status: InvoiceView["status"], dueDate: string, total = 50000): InvoiceView => ({ invoice: { id, dueDate } as never, cardId: "c", cardName: "Nubank", totalCents: total, purchaseCount: 2, status });
const TODAY = "2026-10-28";

describe("buildUpcoming", () => {
  it("junta contas não pagas e faturas, ordenadas pelo vencimento", () => {
    const list = buildUpcoming({ today: TODAY, recurrences: [rec({ id: "a" }), rec({ id: "b", description: "Luz", dayOfMonth: 30 })], invoices: [inv("f1", "fechada", "2026-11-12"), inv("f2", "aberta", "2026-12-12")], months: 3 });
    expect(list.map((i) => `${i.dueDate} ${i.kind} ${i.title}`)).toEqual([
      "2026-10-05 conta Aluguel",
      "2026-10-30 conta Luz",
      "2026-11-05 conta Aluguel",
      "2026-11-12 fatura Fatura Nubank",
      "2026-11-30 conta Luz",
      "2026-12-05 conta Aluguel",
      "2026-12-12 fatura Fatura Nubank",
      "2026-12-30 conta Luz",
    ]);
  });

  it("não lista conta paga, fatura paga, fatura zerada nem o que passa do período", () => {
    const list = buildUpcoming({
      today: TODAY, months: 2,
      recurrences: [rec({ paidDates: ["2026-10-05"] })],
      invoices: [inv("p", "paga", "2026-11-01"), inv("z", "fechada", "2026-11-02", 0), inv("longe", "aberta", "2027-06-12")],
    });
    expect(list.map((i) => i.id)).toEqual(["conta:r1:2026-11-05"]);
  });

  it("marca atrasada, hoje e próxima", () => {
    const list = buildUpcoming({ today: TODAY, months: 1, recurrences: [rec({ id: "a", dayOfMonth: 5 }), rec({ id: "b", dayOfMonth: 28 }), rec({ id: "c", dayOfMonth: 30 })], invoices: [inv("f", "atrasada", "2026-10-10")] });
    expect(list.map((i) => [i.title, i.status])).toEqual([["Aluguel", "atrasada"], ["Fatura Nubank", "atrasada"], ["Aluguel", "hoje"], ["Aluguel", "proxima"]]);
  });

  it("detalhe da fatura", () => {
    expect(buildUpcoming({ today: TODAY, recurrences: [], invoices: [inv("f", "fechada", "2026-11-05")], months: 2 })[0]).toMatchObject({ kind: "fatura", detail: "Fatura fechada", href: "/faturas" });
  });
});
