import { monthsUntil } from "@/services/goals/compute";
import type { Goal } from "@/types/domain";
import type { PlanMonth } from "./projection";

export interface GoalHint {
  goalId: string;
  name: string;
  remainingCents: number;
  /** "prazo": tem data e dá para comparar com a sobra; "ritmo": sem data, estima quando termina no ritmo da sobra. */
  kind: "prazo" | "ritmo";
  needPerMonthCents?: number;
  fits?: boolean;
  monthsToFinish?: number | null;
}

/** Sobra média por mês (só meses com receita prevista). undefined = sem receita cadastrada para comparar. */
export function averageFreeCents(plan: PlanMonth[]): number | undefined {
  const withIncome = plan.filter((m) => m.incomeCents > 0);
  if (withIncome.length === 0) return undefined;
  return Math.round(withIncome.reduce((s, m) => s + m.balanceCents, 0) / withIncome.length);
}

/** Cruza as metas com a sobra prevista: "cabe no planejamento?" ou "em quantos meses termina no ritmo atual". */
export function goalHints(goals: Goal[], freeCents: number | undefined, today: string, limit = 3): GoalHint[] {
  if (freeCents === undefined) return [];
  const out: GoalHint[] = [];
  for (const g of goals) {
    const remainingCents = Math.max(0, g.targetCents - g.currentCents);
    if (remainingCents === 0) continue;
    if (g.deadline) {
      if (g.deadline < today) continue; // meta atrasada: não cabe "planejar"
      const needPerMonthCents = Math.ceil(remainingCents / monthsUntil(today, g.deadline));
      out.push({ goalId: g.id, name: g.name, remainingCents, kind: "prazo", needPerMonthCents, fits: needPerMonthCents <= Math.max(0, freeCents) });
    } else {
      out.push({ goalId: g.id, name: g.name, remainingCents, kind: "ritmo", monthsToFinish: freeCents > 0 ? Math.ceil(remainingCents / freeCents) : null });
    }
  }
  return out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "prazo" ? -1 : 1)).slice(0, limit);
}

/** Primeiro mês (entre os mostrados) em que a sobra prevista fica negativa, só se há receita prevista nele. */
export function firstNegativeMonth(plan: PlanMonth[]): PlanMonth | undefined {
  return plan.find((m) => m.incomeCents > 0 && m.balanceCents < 0);
}
