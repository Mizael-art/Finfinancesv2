import { describe, expect, it } from "vitest";
import { cycleClosingIn, invoiceCycle, invoiceIdFor } from "./cycle";

const nu = { closingDay: 12, dueDay: 19 };

describe("ciclo da fatura", () => {
  it("compra até o dia do fechamento (inclusive) entra na fatura do mês", () => {
    expect(invoiceCycle(nu, "2026-09-06")).toEqual({ referenceKey: "2026-09", closingDate: "2026-09-12", dueDate: "2026-09-19" });
    expect(invoiceCycle(nu, "2026-09-12").referenceKey).toBe("2026-09");
  });
  it("compra depois do fechamento vai para a fatura seguinte", () => {
    expect(invoiceCycle(nu, "2026-09-13")).toEqual({ referenceKey: "2026-10", closingDate: "2026-10-12", dueDate: "2026-10-19" });
  });
  it("vencimento antes do fechamento no calendário cai no mês seguinte (fecha 20, vence 5)", () => {
    const c = { closingDay: 20, dueDay: 5 };
    expect(invoiceCycle(c, "2026-09-10")).toEqual({ referenceKey: "2026-10", closingDate: "2026-09-20", dueDate: "2026-10-05" });
    expect(invoiceCycle(c, "2026-12-25")).toEqual({ referenceKey: "2027-02", closingDate: "2027-01-20", dueDate: "2027-02-05" });
  });
  it("vira o ano", () => {
    expect(invoiceCycle(nu, "2026-12-20")).toEqual({ referenceKey: "2027-01", closingDate: "2027-01-12", dueDate: "2027-01-19" });
  });
  it("dia 31 de fechamento: fevereiro fecha no último dia", () => {
    const c = { closingDay: 31, dueDay: 10 };
    expect(cycleClosingIn(c, 2026, 2)).toEqual({ referenceKey: "2026-03", closingDate: "2026-02-28", dueDate: "2026-03-10" });
    expect(invoiceCycle(c, "2028-02-29").closingDate).toBe("2028-02-29");
  });
  it("offset empurra para frente (parcelas) sem somar duas vezes", () => {
    expect(invoiceCycle(nu, "2026-09-06", 0).referenceKey).toBe("2026-09");
    expect(invoiceCycle(nu, "2026-09-06", 3).referenceKey).toBe("2026-12");
    expect(invoiceCycle(nu, "2026-09-13", 11).referenceKey).toBe("2027-09");
  });
  it("id da fatura é determinístico", () => {
    expect(invoiceIdFor("c1", "2026-09")).toBe("inv:c1:2026-09");
  });
});
