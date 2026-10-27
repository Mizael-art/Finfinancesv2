import { formatBRL } from "./format";

/** Dinheiro é guardado em centavos inteiros; só a borda da tela converte para reais. */
export const toCents = (reais: number): number => Math.round(reais * 100);
export const fromCents = (cents: number): number => cents / 100;

/** "R$1.234,56" — sempre via formatBRL do design system. */
export const formatCents = (cents: number): string => formatBRL(cents / 100);

/**
 * Divide `total` em `parts` partes inteiras que somam exatamente o total.
 * A sobra de centavos vai para as primeiras (10000 em 3 => 3334, 3333, 3333).
 */
export function splitCents(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const rest = total - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < rest ? 1 : 0));
}
