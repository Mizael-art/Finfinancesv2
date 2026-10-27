import { clampedDate, parseISODate } from "@/lib/date";
import type { Card } from "@/types/domain";

export interface InvoiceCycle {
  /** "YYYY-MM" do vencimento. */
  referenceKey: string;
  closingDate: string;
  dueDate: string;
}

type CycleCard = Pick<Card, "closingDay" | "dueDay">;

export const invoiceIdFor = (cardId: string, referenceKey: string) => `inv:${cardId}:${referenceKey}`;

/** Ciclo que FECHA no mês informado (mês 1–12). Se o vencimento é antes do fechamento no calendário, cai no mês seguinte. */
export function cycleClosingIn(card: CycleCard, year: number, month1: number): InvoiceCycle {
  const closingDate = clampedDate(year, month1, card.closingDay);
  const dueMonthTotal = year * 12 + (month1 - 1) + (card.dueDay > card.closingDay ? 0 : 1);
  const dueYear = Math.floor(dueMonthTotal / 12);
  const dueMonth = (dueMonthTotal % 12) + 1;
  const dueDate = clampedDate(dueYear, dueMonth, card.dueDay);
  return { referenceKey: dueDate.slice(0, 7), closingDate, dueDate };
}

/**
 * Fatura em que uma compra cai. Compra até o dia do fechamento (inclusive) entra na fatura
 * que fecha neste mês; depois, na seguinte. `offsetMonths` empurra para frente (parcelas).
 */
export function invoiceCycle(card: CycleCard, purchaseDate: string, offsetMonths = 0): InvoiceCycle {
  const d = parseISODate(purchaseDate);
  let month0 = d.getFullYear() * 12 + d.getMonth();
  if (purchaseDate > clampedDate(d.getFullYear(), d.getMonth() + 1, card.closingDay)) month0 += 1;
  month0 += offsetMonths;
  return cycleClosingIn(card, Math.floor(month0 / 12), (month0 % 12) + 1);
}
