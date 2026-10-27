/** Cor de barra de progresso compartilhada (limite de cartão, orçamento, meta).
 * Mesma escala usada em CardLimitSummary: verde -> amarelo -> vermelho. */
export function progressColor(pct: number) {
  if (pct >= 100) return "rgb(var(--bad))";
  if (pct >= 80) return "rgb(var(--warn))";
  return "rgb(var(--ok))";
}
