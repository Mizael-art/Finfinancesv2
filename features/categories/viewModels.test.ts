import { describe, expect, it } from "vitest";
import type { Category } from "@/types/domain";
import { buildCategoryRows, movementLabel, usageSentence, type CategoryOverviewItem } from "./viewModels";

const item = (name: string, kind: Category["kind"], periodCents: number, count = 0): CategoryOverviewItem => ({
  category: { id: name, name, kind, isDefault: false, createdAt: "", updatedAt: "" }, periodCents, periodCount: count, usage: { transactions: count, budgets: 0, recurrences: 0 },
});

describe("linhas de categorias", () => {
  const items = [item("Lazer", "despesa", 2500, 2), item("Alimentação", "despesa", 7500, 5), item("Pet", "despesa", 0), item("Casa", "despesa", 0), item("Salário", "receita", 100000, 1)];
  it("filtra por tipo, ordena por valor e depois por nome", () => {
    const { rows, totalCents } = buildCategoryRows(items, "despesa");
    expect(rows.map((r) => r.category.name)).toEqual(["Alimentação", "Lazer", "Casa", "Pet"]);
    expect(totalCents).toBe(10000);
  });
  it("fatia do total em %", () => {
    const { rows } = buildCategoryRows(items, "despesa");
    expect(rows.map((r) => r.sharePercent)).toEqual([75, 25, 0, 0]);
  });
  it("sem nenhum valor no período, todas as fatias são 0 (sem divisão por zero)", () => {
    expect(buildCategoryRows([item("Pet", "despesa", 0)], "despesa").rows[0].sharePercent).toBe(0);
    expect(buildCategoryRows([], "receita")).toEqual({ rows: [], totalCents: 0 });
  });
  it("textos", () => {
    expect(movementLabel(0)).toBe("Sem movimento");
    expect(movementLabel(1)).toBe("1 transação");
    expect(movementLabel(7)).toBe("7 transações");
    expect(usageSentence({ transactions: 3, budgets: 1, recurrences: 2 })).toBe("3 transações, 1 orçamento e 2 repetições");
    expect(usageSentence({ transactions: 1, budgets: 0, recurrences: 0 })).toBe("1 transação");
  });
});
