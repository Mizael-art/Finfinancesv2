import { addDays, clampedDate, formatMonthLabel } from "./date";

/**
 * "Mês financeiro": começa no dia `firstDay` (1–28, configurável) e é nomeado pelo mês em que COMEÇA.
 * Com firstDay = 5, "2026-10" vai de 05/10 a 04/11. Com 1, é o mês de calendário.
 * Tudo em datas de calendário ("YYYY-MM-DD"), sem fuso.
 */
export type MonthKey = string; // "YYYY-MM"

export const addMonthKey = (key: MonthKey, n: number): MonthKey => {
  const [y, m] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
};

/** Mês financeiro em que `today` está. */
export function currentMonthKey(today: string, firstDay = 1): MonthKey {
  const key = today.slice(0, 7);
  return Number(today.slice(8, 10)) < firstDay ? addMonthKey(key, -1) : key;
}

export function financialMonthRange(key: MonthKey, firstDay = 1): { from: string; to: string } {
  const [y, m] = key.split("-").map(Number);
  const from = clampedDate(y, m, firstDay);
  const [ny, nm] = addMonthKey(key, 1).split("-").map(Number);
  return { from, to: addDays(clampedDate(ny, nm, firstDay), -1) };
}

export const monthKeyLabel = (key: MonthKey): string => formatMonthLabel(key);
