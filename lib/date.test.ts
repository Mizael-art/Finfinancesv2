import { describe, expect, it } from "vitest";
import { formatDayLabel, groupByDay, nowISO, addMonths, clampedDate, endOfMonth, formatShortDate, isBetween, isValidISODate, monthKey, parseISODate, startOfMonth, toISODate } from "./date";

describe("datas de calendário (fuso America/Sao_Paulo)", () => {
  it("parseISODate não perde um dia (o bug do new Date('YYYY-MM-DD') em UTC)", () => {
    expect(new Date("2026-09-28").getDate()).toBe(27); // documenta o problema que evitamos
    const d = parseISODate("2026-09-28");
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 9, 28]);
  });

  it("toISODate usa o dia LOCAL, mesmo às 23h59", () => {
    expect(toISODate(new Date(2026, 8, 28, 23, 59))).toBe("2026-09-28");
    expect(toISODate(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
  });

  it("ida e volta é estável", () => {
    for (const iso of ["2026-01-31", "2026-02-28", "2028-02-29", "2026-12-31"]) expect(toISODate(parseISODate(iso))).toBe(iso);
  });

  it("rejeita datas inexistentes ou mal formadas", () => {
    expect(isValidISODate("2026-02-30")).toBe(false);
    expect(isValidISODate("2026-13-01")).toBe(false);
    expect(isValidISODate("28/09/2026")).toBe(false);
    expect(isValidISODate("2028-02-29")).toBe(true);
    expect(isValidISODate("2026-02-29")).toBe(false);
  });

  it("addMonths ajusta o dia ao tamanho do mês", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-11-15", 3)).toBe("2027-02-15");
    expect(addMonths("2026-03-15", -3)).toBe("2025-12-15");
    expect(addMonths("2026-12-31", 12)).toBe("2027-12-31");
  });

  it("clampedDate e limites do mês", () => {
    expect(clampedDate(2026, 2, 31)).toBe("2026-02-28");
    expect(clampedDate(2026, 4, 31)).toBe("2026-04-30");
    expect(startOfMonth("2026-09-17")).toBe("2026-09-01");
    expect(endOfMonth("2026-09-17")).toBe("2026-09-30");
    expect(endOfMonth("2028-02-10")).toBe("2028-02-29");
  });

  it("monthKey, isBetween e formatação", () => {
    expect(monthKey("2026-09-28")).toBe("2026-09");
    expect(isBetween("2026-09-15", "2026-09-01", "2026-09-30")).toBe(true);
    expect(isBetween("2026-10-01", "2026-09-01", "2026-09-30")).toBe(false);
    expect(formatShortDate("2026-09-28")).toBe("28/09/2026");
  });
});

describe("nowISO", () => {
  it("nunca repete um instante, mesmo chamado várias vezes no mesmo milissegundo", () => {
    const stamps = Array.from({ length: 500 }, () => nowISO());
    expect(new Set(stamps).size).toBe(500);
    expect([...stamps].sort()).toEqual(stamps); // e cresce sempre
  });
});

describe("rótulos de dia (data de calendário, sem 'um dia a menos')", () => {
  it("Hoje, Ontem e data por extenso", () => {
    expect(formatDayLabel("2026-09-28", "2026-09-28")).toBe("Hoje");
    expect(formatDayLabel("2026-09-27", "2026-09-28")).toBe("Ontem");
    expect(formatDayLabel("2026-08-31", "2026-09-01")).toBe("Ontem"); // atravessa o mês
    expect(formatDayLabel("2026-09-20", "2026-09-28")).toBe("20 de setembro");
    expect(formatDayLabel("2026-10-01", "2026-09-28")).toBe("01 de outubro"); // futuro (parcelas)
    expect(formatDayLabel("2025-09-20", "2026-09-28")).toBe("20 de setembro de 2025"); // outro ano ganha o ano
  });

  it("agrupa por dia preservando a ordem", () => {
    const items = [{ date: "2026-09-28", id: 1 }, { date: "2026-09-28", id: 2 }, { date: "2026-09-27", id: 3 }, { date: "2026-09-10", id: 4 }];
    expect(groupByDay(items, "2026-09-28").map((g) => [g.label, g.items.map((i) => i.id)])).toEqual([
      ["Hoje", [1, 2]], ["Ontem", [3]], ["10 de setembro", [4]],
    ]);
  });
});
