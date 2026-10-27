import type { Card } from "@/types/domain";
import { guessModelId, modelById, type CardModel } from "./models";

/** Modelo visual do cartão: o escolhido pelo usuário vence; sem escolha (dado antigo), reconhece pelo nome. */
export function resolveModel(card: Pick<Card, "issuer" | "name" | "institution">): CardModel {
  return modelById(card.issuer ?? guessModelId(card.name, card.institution));
}

/** Rótulo do dia: "dia 12". */
export const dayLabel = (d: number) => `dia ${d}`;

/** Porcentagem do limite usada, sem passar de 100 na barra. */
export function usagePercent(usedCents: number, limitCents: number): { raw: number; bar: number } {
  if (limitCents <= 0) return { raw: usedCents > 0 ? 100 : 0, bar: usedCents > 0 ? 100 : 0 };
  const raw = Math.round((usedCents / limitCents) * 100);
  return { raw, bar: Math.max(0, Math.min(100, raw)) };
}
