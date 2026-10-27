import { describe, expect, it } from "vitest";
import type { AccountWithBalance } from "@/services/accounts";
import { initialsOf, lookFor, matchBank } from "./banks";
import { toBankCard, toFullAccount, toWalletCards } from "./viewModels";

let n = 0;
const acc = (name: string, balanceCents: number, over: Partial<AccountWithBalance> = {}): AccountWithBalance => ({
  id: name, name, type: "digital", initialBalanceCents: 0, balanceCents, series: [0, balanceCents], createdAt: `2026-01-0${++n}`, updatedAt: "", ...over,
}) as AccountWithBalance;

describe("banks", () => {
  it("reconhece bancos pelo nome ou instituição", () => {
    expect(matchBank("Nubank")).toBe("nu");
    expect(matchBank("Minha conta", "Banco Inter")).toBe("inter");
    expect(matchBank("C6")).toBe("c6");
    expect(matchBank("Conta da vovó")).toBe("outro");
  });
  it("iniciais e visual", () => {
    expect(initialsOf("Conta Viagem")).toBe("CV");
    expect(initialsOf("Reserva")).toBe("Re");
    expect(lookFor({ name: "Carteira", type: "carteira" }).glyph).toBe("$");
    expect(lookFor({ name: "Nubank", type: "digital" }).wordmark).toBe("nu");
    expect(lookFor({ name: "Itaú", type: "corrente" }).wordmark).toBe("generic");
    expect(lookFor({ name: "X", type: "corrente", tone: ["#111", "#222"], glyph: "ZZ" })).toMatchObject({ tone: ["#111", "#222"], glyph: "ZZ" });
  });
});

describe("viewModels", () => {
  it("converte centavos em reais só na borda", () => {
    expect(toFullAccount(acc("Nubank", 123456)).balance).toBe(1234.56);
    expect(toBankCard(acc("Nubank", 100)).trend).toEqual([0, 1]);
  });
  it("carteira: maior saldo na frente, até 3", () => {
    const w = toWalletCards([acc("A", 100), acc("B", 500), acc("C", 300), acc("D", 900)]);
    expect(w.map((c) => c.name)).toEqual(["C", "B", "D"]); // fundo → frente
    expect(w[2].y).toBeGreaterThan(w[0].y);
  });
  it("com menos de 3 contas ocupam os lugares da frente", () => {
    const one = toWalletCards([acc("A", 1)]);
    expect(one).toHaveLength(1);
    expect(one[0].y).toBe(190);
    const two = toWalletCards([acc("A", 1), acc("B", 2)]);
    expect(two.map((c) => c.name)).toEqual(["A", "B"]);
    expect(two.map((c) => c.y)).toEqual([90, 190]);
  });
  it("saldo negativo continua negativo", () => {
    expect(toFullAccount(acc("Nubank", -5000)).balance).toBe(-50);
  });
});
