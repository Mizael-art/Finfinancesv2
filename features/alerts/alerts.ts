import { reminderBills } from "@/features/bills/bills";
import { firstNegativeMonth } from "@/features/planning/goals";
import type { PlanMonth } from "@/features/planning/projection";
import { addDays, formatDayMonth, monthName } from "@/lib/date";
import { formatCents } from "@/lib/money";
import type { BudgetItem } from "@/services/budgets/compute";
import type { InvoiceView } from "@/services/invoices/compute";
import type { Recurrence } from "@/types/domain";

export interface AppAlert {
  id: string;
  /** alta = precisa de ação agora; media = fique de olho. */
  severity: "alta" | "media";
  title: string;
  detail: string;
  href: string;
}

export interface AlertInput {
  today: string;
  recurrences: Recurrence[];
  budgets: BudgetItem[];
  cards: { id: string; name: string; limitCents: number; usedCents: number }[];
  invoices: InvoiceView[];
  /** Previsão dos próximos meses (já sem o mês atual vazio), para avisar de sobra negativa. */
  plan?: PlanMonth[];
}

export interface AlertsResult { alerts: AppAlert[]; /** Quantas contas/faturas pedem ação (vai no ícone do app). */ badge: number }

const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
const when = (days: number) => (days <= 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`);
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Avisos da tela inicial: contas a pagar, faturas, orçamentos, limite do cartão e sobra negativa. Mais urgentes primeiro. */
export function buildAlerts({ today, recurrences, budgets, cards, invoices, plan }: AlertInput): AlertsResult {
  const out: AppAlert[] = [];
  let badge = 0;

  // Contas (despesas fixas)
  const { overdue, soon } = reminderBills(recurrences, today, 3);
  const soonOnly = soon.filter((b) => !overdue.some((o) => o.key === b.key));
  if (overdue.length > 0) {
    const total = overdue.reduce((s, b) => s + b.recurrence.amountCents, 0);
    out.push({
      id: "contas-atrasadas", severity: "alta", href: "/fixas",
      title: overdue.length === 1 ? `${overdue[0].recurrence.description} está atrasada` : `${overdue.length} contas atrasadas`,
      detail: overdue.length === 1 ? `Venceu em ${formatDayMonth(overdue[0].dueDate)} · ${formatCents(total)}. Toque para marcar como paga.` : `Somam ${formatCents(total)}. Toque para ver e marcar como pagas.`,
    });
    badge += overdue.length;
  }
  if (soonOnly.length > 0) {
    const total = soonOnly.reduce((s, b) => s + b.recurrence.amountCents, 0);
    const first = soonOnly[0];
    const days = dayDiff(today, first.dueDate);
    out.push({
      id: "contas-vencendo", severity: days <= 0 ? "alta" : "media", href: "/fixas",
      title: soonOnly.length === 1 ? `${first.recurrence.description} vence ${when(days)}` : `${plural(soonOnly.length, "conta vence", "contas vencem")} nos próximos 3 dias`,
      detail: soonOnly.length === 1 ? formatCents(total) : `Somam ${formatCents(total)}.`,
    });
    badge += soonOnly.length;
  }

  // Faturas de cartão
  const horizon = addDays(today, 5);
  for (const v of invoices) {
    if (v.totalCents <= 0) continue;
    if (v.status === "atrasada") {
      out.push({ id: `fatura-${v.invoice.id}`, severity: "alta", href: "/faturas", title: `Fatura do ${v.cardName} atrasada`, detail: `${formatCents(v.totalCents)} · venceu em ${formatDayMonth(v.invoice.dueDate)}.` });
      badge++;
    } else if (v.status === "fechada" && v.invoice.dueDate <= horizon) {
      const days = dayDiff(today, v.invoice.dueDate);
      out.push({ id: `fatura-${v.invoice.id}`, severity: days <= 2 ? "alta" : "media", href: "/faturas", title: `Fatura do ${v.cardName} vence ${when(days)}`, detail: `${formatCents(v.totalCents)} · ${formatDayMonth(v.invoice.dueDate)}.` });
      badge++;
    }
  }

  // Orçamentos do mês
  const flagged = budgets.filter((b) => b.status !== "ok").sort((a, b) => b.percent - a.percent);
  for (const b of flagged.slice(0, 2)) {
    out.push({
      id: `orcamento-${b.budget.id}`, severity: b.status === "estourado" ? "alta" : "media", href: "/orcamentos",
      title: b.status === "estourado" ? `Orçamento de ${b.category.name} estourou` : `Orçamento de ${b.category.name} em ${b.percent}%`,
      detail: b.status === "estourado" ? `Passou ${formatCents(Math.abs(b.remainingCents))} do limite de ${formatCents(b.budget.limitCents)}.` : `Restam ${formatCents(b.remainingCents)} de ${formatCents(b.budget.limitCents)}.`,
    });
  }
  if (flagged.length > 2) out.push({ id: "orcamentos-mais", severity: "media", href: "/orcamentos", title: `Mais ${plural(flagged.length - 2, "orçamento pede", "orçamentos pedem")} atenção`, detail: "Veja todos na tela de Orçamentos." });

  // Limite dos cartões
  for (const c of cards) {
    if (c.limitCents <= 0) continue;
    const pct = Math.round((c.usedCents / c.limitCents) * 100);
    if (pct >= 80) {
      out.push({
        id: `limite-${c.id}`, severity: pct >= 100 ? "alta" : "media", href: "/cartoes",
        title: pct >= 100 ? `Limite do ${c.name} ultrapassado` : `Você usou ${pct}% do limite do ${c.name}`,
        detail: pct >= 100 ? `Usado ${formatCents(c.usedCents)} de ${formatCents(c.limitCents)}.` : `Restam ${formatCents(c.limitCents - c.usedCents)}.`,
      });
    }
  }

  // Sobra negativa na previsão
  const negative = plan ? firstNegativeMonth(plan) : undefined;
  if (negative) {
    out.push({ id: "planejamento-negativo", severity: "media", href: "/planejamento", title: `Em ${monthName(negative.key)} a sobra prevista fica negativa`, detail: `${formatCents(negative.balanceCents)} segundo o planejamento.` });
  }

  const rank = { alta: 0, media: 1 } as const;
  return { alerts: out.map((a, i) => ({ a, i })).sort((x, y) => rank[x.a.severity] - rank[y.a.severity] || x.i - y.i).map((x) => x.a), badge };
}
