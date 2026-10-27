import { describe, expect, it } from "vitest";
import { changeSentence, comparisonLabels, toDonutSlices, toTopItems } from "./viewModels";

describe("reports view-models", () => {
  it("rótulos de comparação", () => {
    expect(comparisonLabels({ from: "2026-10-01", to: "2026-10-31" }, { from: "2026-09-01", to: "2026-09-30" })).toEqual({ previous: "Setembro", current: "Outubro" });
    expect(comparisonLabels({ from: "2026-01-01", to: "2026-12-31" }, { from: "2025-01-01", to: "2025-12-31" })).toEqual({ previous: "2025", current: "2026" });
    expect(comparisonLabels({ from: "2026-08-01", to: "2026-10-31" }, { from: "2026-05-01", to: "2026-07-31" })).toEqual({ previous: "Período anterior", current: "Este período" });
    expect(comparisonLabels({ from: "2026-10-10", to: "2026-11-09" }, { from: "2026-09-10", to: "2026-10-09" })).toEqual({ previous: "Setembro", current: "Outubro" });
    expect(comparisonLabels({ from: "2026-10-10", to: "2026-12-09" }, { from: "2026-08-10", to: "2026-10-09" })).toEqual({ previous: "Período anterior", current: "Este período" });
    expect(comparisonLabels({}, null)).toBeNull();
  });
  it("frase de variação", () => {
    expect(changeSentence(75, 100)).toBe("Você gastou 25% a menos que no período anterior.");
    expect(changeSentence(150, 100)).toBe("Você gastou 50% a mais que no período anterior.");
    expect(changeSentence(100, 100)).toBe("Gastos iguais ao período anterior.");
    expect(changeSentence(100, 0)).toBeNull();
    expect(changeSentence(999, 100)).toBe("Você gastou 899% a mais que no período anterior.");
    expect(changeSentence(1100, 100)).toBe("Você gastou mais de 10 vezes o valor do período anterior.");
  });
  it("converte centavos em reais só na borda", () => {
    expect(toDonutSlices([{ categoryId: "c", name: "Lazer", color: "#fff", cents: 12345, percent: 40 }])).toEqual([{ category: "Lazer", pct: 40, color: "#fff", amount: 123.45 }]);
    const t = { id: "t", type: "despesa", amountCents: 5000, description: "Jantar", date: "2026-10-05", createdAt: "", updatedAt: "" } as never;
    expect(toTopItems([{ transaction: t, categoryName: "Lazer", color: "#fff" }])[0]).toMatchObject({ amount: 50, category: "Lazer", categoryColor: "#fff", description: "Jantar" });
  });
});
