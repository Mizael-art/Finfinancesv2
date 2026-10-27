import { describe, expect, it } from "vitest";
import { CARD_MODELS, guessModelId, modelById } from "./models";
import { resolveModel, usagePercent } from "./viewModels";

describe("modelos de cartão", () => {
  it("ids são únicos e 'outro' é o último", () => {
    expect(new Set(CARD_MODELS.map((m) => m.id)).size).toBe(CARD_MODELS.length);
    expect(CARD_MODELS.at(-1)!.id).toBe("outro");
  });
  it("modelo escolhido vence a adivinhação pelo nome ('Outro banco' fica 'outro' mesmo se o nome lembra Itaú)", () => {
    expect(resolveModel({ issuer: "outro", name: "Itaú Black", institution: "Itaú" }).id).toBe("outro");
    expect(resolveModel({ issuer: undefined, name: "Itaú Black", institution: "Itaú" }).id).toBe("itau");
    expect(resolveModel({ issuer: "nu", name: "x", institution: "y" }).id).toBe("nu");
  });
  it("modelo desconhecido cai em 'outro'", () => {
    expect(modelById("nada").id).toBe("outro");
    expect(guessModelId("Meu cartão", "Banco Qualquer")).toBe("outro");
  });
  it("percentual de uso: barra limitada a 100, valor real preservado", () => {
    expect(usagePercent(1760, 5000)).toEqual({ raw: 35, bar: 35 });
    expect(usagePercent(6000, 5000)).toEqual({ raw: 120, bar: 100 });
    expect(usagePercent(0, 0)).toEqual({ raw: 0, bar: 0 });
    expect(usagePercent(10, 0)).toEqual({ raw: 100, bar: 100 });
  });
});
