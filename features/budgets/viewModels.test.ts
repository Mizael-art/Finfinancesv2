import { describe, expect, it } from "vitest";
import type { BudgetItem } from "@/services/budgets/compute";
import { attentionCount, attentionSentence, toBudgetCard } from "./viewModels";

const item = (spent: number, limit: number, status: BudgetItem["status"]): BudgetItem => ({
  budget: { id: "b", categoryId: "c", limitCents: limit, period: "monthly", createdAt: "", updatedAt: "" },
  category: { id: "c", name: "Lazer", kind: "despesa", color: "#fff", isDefault: false, createdAt: "", updatedAt: "" } as never,
  spentCents: spent, remainingCents: limit - spent, percent: 0, status,
});

describe("budgets view-models", () => {
  it("converte centavos em reais só na borda", () => {
    expect(toBudgetCard(item(12345, 50000, "ok"), "Outubro de 2026")).toMatchObject({ category: "Lazer", spent: 123.45, limit: 500, color: "#fff", period: "Outubro de 2026" });
  });
  it("conta atenção e estourado; frase no singular/plural", () => {
    const list = [item(1, 10, "ok"), item(9, 10, "atencao"), item(12, 10, "estourado")];
    expect(attentionCount(list)).toBe(2);
    expect(attentionSentence(0)).toBe("Tudo dentro do planejado.");
    expect(attentionSentence(1)).toBe("1 orçamento pede atenção.");
    expect(attentionSentence(2)).toBe("2 orçamentos pedem atenção.");
  });
});
