import { addMonths, monthKey } from "@/lib/date";
import { occurrencesUpTo } from "@/services/recurrences/schedule";
import type { Recurrence } from "@/types/domain";

/**
 * Próximo vencimento de uma despesa fixa, depois de hoje. O que já foi lançado (até `lastGeneratedDate`)
 * não conta: se a conta deste mês já foi lançada, o próximo vencimento cai no mês seguinte.
 * Pausada ou encerrada = sem próximo vencimento.
 */
export function nextDueDate(r: Recurrence, today: string): string | undefined {
  if (!r.active) return undefined;
  const after = r.lastGeneratedDate && r.lastGeneratedDate > today ? r.lastGeneratedDate : today;
  return occurrencesUpTo({ ...r, lastGeneratedDate: after }, addMonths(today, 14))[0];
}

export interface DueGroup<T> { key: string; items: T[] }

/** Agrupa pelo mês do próximo vencimento, do mês mais próximo para o mais distante; sem vencimento vai por último ("sem"). */
export function groupByDueMonth<T extends { recurrence: Recurrence; next?: string }>(entries: T[]): DueGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const e of entries) {
    const key = e.next ? monthKey(e.next) : "sem";
    map.set(key, [...(map.get(key) ?? []), e]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a === "sem" ? 1 : b === "sem" ? -1 : a.localeCompare(b)))
    .map(([key, items]) => ({ key, items: items.sort((x, y) => (x.next ?? "").localeCompare(y.next ?? "") || x.recurrence.description.localeCompare(y.recurrence.description, "pt-BR")) }));
}
