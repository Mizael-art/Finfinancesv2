import { formatDayMonth, formatMonthLabel } from "@/lib/date";
import type { InvoiceStatus } from "@/types/domain";
import type { InvoiceView } from "@/services/invoices/compute";

export const STATUS_LABEL: Record<InvoiceStatus, string> = { aberta: "Aberta", fechada: "Fechada", paga: "Paga", atrasada: "Atrasada" };

/** Cores dos selos de status (mesma paleta do app). */
/** Cores por situação, vindas das variáveis do tema (legíveis nos escuros e nos claros). */
const toneOf = (v: string) => ({ text: `rgb(var(--${v}))`, bg: `rgb(var(--${v}) / 0.14)` });
export const STATUS_TONE: Record<InvoiceStatus, { text: string; bg: string }> = {
  aberta: toneOf("info"),
  fechada: toneOf("warn"),
  paga: toneOf("ok"),
  atrasada: toneOf("bad"),
};

export const referenceLabel = (v: Pick<InvoiceView, "invoice">) => formatMonthLabel(v.invoice.referenceKey);

/** "vence 19/09", "venceu 19/09", "paga em 18/09". */
export function dueText(v: InvoiceView, today: string): string {
  if (v.status === "paga") return `Paga em ${formatDayMonth(v.paidDate ?? v.invoice.dueDate)}`;
  if (v.status === "aberta") return `Fecha ${formatDayMonth(v.invoice.closingDate)} · vence ${formatDayMonth(v.invoice.dueDate)}`;
  return v.invoice.dueDate < today ? `Venceu ${formatDayMonth(v.invoice.dueDate)}` : `Vence ${formatDayMonth(v.invoice.dueDate)}`;
}

export interface InvoiceGroups {
  atrasadas: InvoiceView[];
  paraPagar: InvoiceView[];
  abertas: InvoiceView[];
  futuras: InvoiceView[];
  pagas: InvoiceView[];
}

/**
 * Separa as faturas por o que o usuário precisa fazer.
 * "Aberta" = a que está recebendo compras agora (a de fechamento mais próximo de cada cartão);
 * as demais abertas são "futuras" (parcelas dos próximos meses).
 */
export function groupInvoices(views: InvoiceView[]): InvoiceGroups {
  const g: InvoiceGroups = { atrasadas: [], paraPagar: [], abertas: [], futuras: [], pagas: [] };
  const open = views.filter((v) => v.status === "aberta").sort((a, b) => a.invoice.closingDate.localeCompare(b.invoice.closingDate));
  const currentByCard = new Set<string>();
  for (const v of open) {
    if (!currentByCard.has(v.cardId)) { currentByCard.add(v.cardId); g.abertas.push(v); } else g.futuras.push(v);
  }
  for (const v of views) {
    if (v.status === "atrasada") g.atrasadas.push(v);
    else if (v.status === "fechada") g.paraPagar.push(v);
    else if (v.status === "paga") g.pagas.push(v);
  }
  g.futuras.sort((a, b) => a.invoice.dueDate.localeCompare(b.invoice.dueDate));
  g.atrasadas.sort((a, b) => a.invoice.dueDate.localeCompare(b.invoice.dueDate));
  g.paraPagar.sort((a, b) => a.invoice.dueDate.localeCompare(b.invoice.dueDate));
  return g;
}

export interface InvoicesSummary {
  /** Faturas fechadas + atrasadas que ainda precisam ser pagas. */
  toPayCents: number;
  overdueCents: number;
  openCents: number;
  nextDue?: { dueDate: string; cardName: string; totalCents: number };
}

export function summarizeInvoices(views: InvoiceView[]): InvoicesSummary {
  const g = groupInvoices(views);
  const sum = (l: InvoiceView[]) => l.reduce((s, v) => s + v.totalCents, 0);
  const next = [...g.atrasadas, ...g.paraPagar].filter((v) => v.totalCents > 0).sort((a, b) => a.invoice.dueDate.localeCompare(b.invoice.dueDate))[0];
  return {
    toPayCents: sum(g.atrasadas) + sum(g.paraPagar),
    overdueCents: sum(g.atrasadas),
    openCents: sum(g.abertas),
    nextDue: next && { dueDate: next.invoice.dueDate, cardName: next.cardName, totalCents: next.totalCents },
  };
}
