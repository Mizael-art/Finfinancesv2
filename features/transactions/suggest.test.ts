import { describe, expect, it } from "vitest";
import type { Transaction } from "@/types/domain";
import { normalizeText, suggestCategory } from "./suggest";

const stamp = { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
const tx = (description: string, categoryId: string, o: Partial<Transaction> = {}): Transaction => ({ id: Math.random().toString(36), ...stamp, type: "despesa", amountCents: 1000, description, date: "2026-09-01", categoryId, ...o });

describe("suggestCategory", () => {
  const history = [tx("Mercado", "alim"), tx("Mercado", "alim"), tx("Mercado", "casa", { date: "2026-10-01" }), tx("Uber", "transp"), tx("Salário", "renda", { type: "receita" })];

  it("descrição idêntica: usa a categoria mais frequente, ignorando acento e caixa", () => {
    expect(suggestCategory(history, "  mercadó ", "despesa")).toMatchObject({ categoryId: "alim", exact: true, count: 2 });
  });
  it("descrição parecida (começa igual) sugere sem ser exata", () => {
    expect(suggestCategory(history, "Mer", "despesa")).toMatchObject({ categoryId: "alim", exact: false });
    expect(suggestCategory(history, "Uber Eats", "despesa")).toMatchObject({ categoryId: "transp", exact: false });
  });
  it("empate de frequência: vence a mais recente", () => {
    const h = [tx("Padaria", "a", { date: "2026-08-01" }), tx("Padaria", "b", { date: "2026-10-01" })];
    expect(suggestCategory(h, "padaria", "despesa")?.categoryId).toBe("b");
  });
  it("respeita o tipo e exige 3 letras", () => {
    expect(suggestCategory(history, "Salário", "despesa")).toBeUndefined();
    expect(suggestCategory(history, "Sal", "receita")?.categoryId).toBe("renda");
    expect(suggestCategory(history, "Me", "despesa")).toBeUndefined();
  });
  it("normalizeText", () => expect(normalizeText("  Açaí   Já ")).toBe("acai ja"));
});
