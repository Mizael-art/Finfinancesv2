import { formatLongDate } from "@/lib/date";
import { formatCents, fromCents } from "@/lib/money";
import type { GoalItem } from "@/services/goals/compute";
import type { Goal as GoalCardModel } from "@/types/finance";

const FALLBACK = "#8B43EA";

/** Escurece "#RRGGBB" (fator 0–1) para o fim do degradê. */
export function shade(hex: string, factor = 0.72): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.round(v * factor).toString(16).padStart(2, "0");
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`.toUpperCase();
}

/** Frase de apoio sob a barra. */
export function goalHint(item: GoalItem): { text: string; late: boolean } | null {
  const { goal, status, monthlyNeededCents, remainingCents } = item;
  if (status === "concluida") return null;
  if (status === "atrasada") return { text: `Prazo vencido em ${formatLongDate(goal.deadline!)} · faltam ${formatCents(remainingCents)}`, late: true };
  if (!goal.deadline) return { text: `Faltam ${formatCents(remainingCents)}`, late: false };
  const per = monthlyNeededCents!;
  return { text: `Até ${formatLongDate(goal.deadline)} · guarde ${formatCents(per)} por mês`, late: false };
}

/** Domínio (centavos) → props do GoalCard (reais), só na fronteira da UI. */
export function toGoalCard(item: GoalItem): GoalCardModel {
  const { goal } = item;
  const color = goal.color ?? FALLBACK;
  const hint = goalHint(item);
  return {
    id: goal.id,
    name: goal.name,
    target: fromCents(goal.targetCents),
    current: fromCents(goal.currentCents),
    deadline: goal.deadline ? formatLongDate(goal.deadline) : "Sem prazo",
    tone: [color, shade(color)],
    glyph: goal.name.trim().slice(0, 1).toUpperCase(),
    hint: hint?.text,
    hintTone: hint?.late ? "late" : undefined,
  };
}
