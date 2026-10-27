import { describe, expect, it } from "vitest";
import { emptyCounts } from "@/services/backup/validate";
import { compareCounts, hasLocalData } from "./viewModels";

describe("backup view-models", () => {
  it("compara contagens e esconde o que está zerado dos dois lados", () => {
    const cur = { ...emptyCounts(), accounts: 2, transactions: 10, users: 1, settings: 1 };
    const inc = { ...emptyCounts(), accounts: 3, goals: 1, users: 1, settings: 1 };
    expect(compareCounts(cur, inc)).toEqual([
      { store: "accounts", label: "contas", current: 2, incoming: 3 },
      { store: "transactions", label: "transações", current: 10, incoming: 0 },
      { store: "goals", label: "metas", current: 0, incoming: 1 },
    ]);
  });
  it("dados locais: só perfil e configurações não contam", () => {
    expect(hasLocalData({ ...emptyCounts(), users: 1, settings: 1 })).toBe(false);
    expect(hasLocalData({ ...emptyCounts(), categories: 13 })).toBe(false); // só as categorias padrão que nascem sozinhas
    expect(hasLocalData({ ...emptyCounts(), transactions: 1 })).toBe(true);
    expect(hasLocalData({ ...emptyCounts(), investments: 1 })).toBe(true);
  });
});
