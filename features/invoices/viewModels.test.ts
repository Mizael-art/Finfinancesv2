import { describe, expect, it } from "vitest";
import type { InvoiceView } from "@/services/invoices/compute";
import type { InvoiceStatus } from "@/types/domain";
import { dueText, groupInvoices, summarizeInvoices } from "./viewModels";

const v = (id: string, cardId: string, status: InvoiceStatus, closing: string, due: string, total: number): InvoiceView => ({
  invoice: { id, cardId, referenceKey: due.slice(0, 7), closingDate: closing, dueDate: due, createdAt: "", updatedAt: "" },
  cardId, cardName: cardId, totalCents: total, purchaseCount: 1, status,
});

describe("faturas agrupadas", () => {
  const list = [
    v("a", "nu", "aberta", "2026-10-12", "2026-10-19", 100),
    v("b", "nu", "aberta", "2026-11-12", "2026-11-19", 50), // futura do mesmo cartão
    v("c", "nu", "fechada", "2026-09-12", "2026-09-19", 300),
    v("d", "inter", "atrasada", "2026-08-05", "2026-08-12", 70),
    v("e", "inter", "paga", "2026-07-05", "2026-07-12", 40),
    v("f", "inter", "aberta", "2026-10-05", "2026-10-12", 10),
  ];
  it("separa o que está recebendo compras, futuras, para pagar, atrasadas e pagas", () => {
    const g = groupInvoices(list);
    expect(g.abertas.map((x) => x.invoice.id).sort()).toEqual(["a", "f"]);
    expect(g.futuras.map((x) => x.invoice.id)).toEqual(["b"]);
    expect(g.paraPagar.map((x) => x.invoice.id)).toEqual(["c"]);
    expect(g.atrasadas.map((x) => x.invoice.id)).toEqual(["d"]);
    expect(g.pagas.map((x) => x.invoice.id)).toEqual(["e"]);
  });
  it("resumo: a pagar = fechadas + atrasadas; próxima a vencer é a mais antiga com valor", () => {
    const s = summarizeInvoices(list);
    expect(s).toMatchObject({ toPayCents: 370, overdueCents: 70, openCents: 110 });
    expect(s.nextDue).toMatchObject({ dueDate: "2026-08-12", totalCents: 70 });
  });
  it("sem nada a pagar não há próxima fatura", () => {
    expect(summarizeInvoices([v("a", "nu", "aberta", "2026-10-12", "2026-10-19", 100)]).nextDue).toBeUndefined();
  });
  it("texto de vencimento por status", () => {
    expect(dueText(list[0], "2026-10-01")).toBe("Fecha 12/10 · vence 19/10");
    expect(dueText(list[2], "2026-09-15")).toBe("Vence 19/09");
    expect(dueText(list[3], "2026-09-15")).toBe("Venceu 12/08");
    expect(dueText({ ...list[4], paidDate: "2026-07-10" }, "2026-09-15")).toBe("Paga em 10/07");
  });
});
