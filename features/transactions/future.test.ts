import { describe, expect, it } from "vitest";
import type { Transaction } from "@/types/domain";
import { rangeFor } from "./periods";
import { toTransactionItems } from "./viewModels";

const stamp = { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
const tx = (o: Partial<Transaction>): Transaction => ({ id: "t", ...stamp, type: "despesa", amountCents: 1000, description: "Pix", date: "2026-12-15", accountId: "a1", ...o });
const lookups = { categories: [], accounts: [{ id: "a1", name: "Nubank" }], cards: [] } as never;

describe("período Futuras", () => {
  it("começa amanhã e não tem fim", () => {
    expect(rangeFor("futuras", "2026-10-28")).toEqual({ from: "2026-10-29" });
  });
});

describe("linha da lista", () => {
  it("lançamento futuro vem marcado como Agendada", () => {
    expect(toTransactionItems([tx({})], lookups, "2026-10-28")[0].note).toBe("Agendada");
  });
  it("junta com a nota de parcela e não marca o que já passou", () => {
    expect(toTransactionItems([tx({ installmentGroupId: "g", installmentNumber: 2, installmentTotal: 10 })], lookups, "2026-10-28")[0].note).toBe("Agendada · Parcela 2/10");
    expect(toTransactionItems([tx({ date: "2026-10-01" })], lookups, "2026-10-28")[0].note).toBeUndefined();
  });
});
