import { describe, expect, it } from "vitest";
import { addMonthKey, currentMonthKey, financialMonthRange } from "./financialMonth";

describe("mês financeiro", () => {
  it("dia 1 = mês de calendário (inclusive fevereiro de ano bissexto)", () => {
    expect(financialMonthRange("2026-10")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(financialMonthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(financialMonthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
  it("começando no dia 5: de 05/10 a 04/11, e dezembro vira o ano", () => {
    expect(financialMonthRange("2026-10", 5)).toEqual({ from: "2026-10-05", to: "2026-11-04" });
    expect(financialMonthRange("2026-12", 5)).toEqual({ from: "2026-12-05", to: "2027-01-04" });
  });
  it("meses seguidos não deixam buraco nem se sobrepõem", () => {
    for (const first of [1, 5, 15, 28]) {
      const a = financialMonthRange("2026-03", first);
      const b = financialMonthRange("2026-04", first);
      const next = new Date(a.to + "T00:00:00"); next.setDate(next.getDate() + 1);
      expect(next.toISOString().slice(0, 10) === b.from || `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}` === b.from).toBe(true);
    }
  });
  it("em qual mês financeiro estamos", () => {
    expect(currentMonthKey("2026-10-20", 1)).toBe("2026-10");
    expect(currentMonthKey("2026-10-03", 5)).toBe("2026-09"); // ainda no mês que começou em 05/09
    expect(currentMonthKey("2026-10-05", 5)).toBe("2026-10");
    expect(currentMonthKey("2026-01-02", 10)).toBe("2025-12");
  });
  it("navegar entre meses", () => {
    expect(addMonthKey("2026-12", 1)).toBe("2027-01");
    expect(addMonthKey("2026-01", -1)).toBe("2025-12");
    expect(addMonthKey("2026-05", -17)).toBe("2024-12");
  });
});
