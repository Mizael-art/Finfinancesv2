import { describe, expect, it } from "vitest";
import { buildGoalItem } from "@/services/goals/compute";
import { goalHint, shade, toGoalCard } from "./viewModels";

const g = (over = {}) => ({ id: "g", name: "viagem", targetCents: 100000, currentCents: 25000, createdAt: "", updatedAt: "", ...over }) as never;
const item = (over = {}, today = "2026-10-20") => buildGoalItem(g(over), today);

describe("goals view-models", () => {
  it("escurece cor sem estourar", () => {
    expect(shade("#FFFFFF", 0.5)).toBe("#808080");
    expect(shade("#000000")).toBe("#000000");
  });
  it("frases de apoio", () => {
    expect(goalHint(item({ deadline: "2026-12-20" }))!.text).toContain("guarde R$");
    expect(goalHint(item({ deadline: "2026-12-20" }))!.text).toContain("por mês");
    expect(goalHint(item({}))!.text).toMatch(/^Faltam R\$/);
    expect(goalHint(item({ deadline: "2026-01-01" }))).toMatchObject({ late: true });
    expect(goalHint(item({ currentCents: 100000 }))).toBeNull();
  });
  it("converte para as props do card", () => {
    expect(toGoalCard(item({ color: "#2AA9F0", deadline: "2026-12-20" }))).toMatchObject({ name: "viagem", target: 1000, current: 250, glyph: "V", tone: ["#2AA9F0", shade("#2AA9F0")] });
    expect(toGoalCard(item({})).deadline).toBe("Sem prazo");
  });
});
