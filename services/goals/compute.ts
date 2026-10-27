import type { Goal } from "@/types/domain";

export type GoalStatus = "andamento" | "concluida" | "atrasada";

export interface GoalItem {
  goal: Goal;
  /** Porcentagem real, travada em 100 para a barra. */
  percent: number;
  remainingCents: number;
  status: GoalStatus;
  /** Quanto guardar por mês para chegar no prazo (null sem prazo, concluída ou atrasada). */
  monthlyNeededCents: number | null;
  monthsLeft: number | null;
}

/** Meses (parciais contam como um) entre hoje e o prazo; mínimo 1. Só datas de calendário. */
export function monthsUntil(today: string, deadline: string): number {
  const [ty, tm, td] = today.split("-").map(Number);
  const [dy, dm, dd] = deadline.split("-").map(Number);
  return Math.max(1, (dy - ty) * 12 + (dm - tm) + (dd > td ? 1 : 0));
}

export function buildGoalItem(goal: Goal, today: string): GoalItem {
  const done = goal.currentCents >= goal.targetCents;
  const late = !done && !!goal.deadline && goal.deadline < today;
  const remainingCents = Math.max(0, goal.targetCents - goal.currentCents);
  const active = !done && !late && !!goal.deadline;
  const monthsLeft = active ? monthsUntil(today, goal.deadline!) : null;
  return {
    goal,
    percent: Math.min(100, Math.floor((goal.currentCents / goal.targetCents) * 100)),
    remainingCents,
    status: done ? "concluida" : late ? "atrasada" : "andamento",
    monthsLeft,
    monthlyNeededCents: monthsLeft ? Math.ceil(remainingCents / monthsLeft) : null,
  };
}

/** Em andamento primeiro (prazo mais próximo antes; sem prazo no fim), depois atrasadas, depois concluídas. */
export function buildGoalItems(goals: Goal[], today: string): GoalItem[] {
  const rank: Record<GoalStatus, number> = { andamento: 0, atrasada: 1, concluida: 2 };
  return goals
    .map((g) => buildGoalItem(g, today))
    .sort((a, b) =>
      rank[a.status] - rank[b.status]
      || (a.goal.deadline ?? "9999").localeCompare(b.goal.deadline ?? "9999")
      || a.goal.name.localeCompare(b.goal.name, "pt-BR"));
}
