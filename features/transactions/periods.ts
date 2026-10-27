import { addMonthKey, currentMonthKey, financialMonthRange } from "@/lib/financialMonth";

export type PeriodId = "mes" | "mes_passado" | "tres_meses" | "ano" | "tudo";

export const PERIODS: { id: PeriodId; label: string; short: string }[] = [
  { id: "mes", label: "Esse mês", short: "Esse Mês" },
  { id: "mes_passado", label: "Mês passado", short: "Mês passado" },
  { id: "tres_meses", label: "Últimos 3 meses", short: "3 meses" },
  { id: "ano", label: "Esse ano", short: "Esse ano" },
  { id: "tudo", label: "Todo o período", short: "Tudo" },
];

/**
 * Intervalo de datas (inclusive) de cada período, em datas de calendário. `tudo` não tem limites.
 * Mês, mês passado e 3 meses seguem o "primeiro dia do mês" das configurações (1 = mês de calendário);
 * o ano é sempre o ano de calendário.
 */
export function rangeFor(id: PeriodId, today: string, firstDay = 1): { from?: string; to?: string } {
  const cur = currentMonthKey(today, firstDay);
  switch (id) {
    case "mes": return financialMonthRange(cur, firstDay);
    case "mes_passado": return financialMonthRange(addMonthKey(cur, -1), firstDay);
    case "tres_meses": return { from: financialMonthRange(addMonthKey(cur, -2), firstDay).from, to: financialMonthRange(cur, firstDay).to };
    case "ano": return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    case "tudo": return {};
  }
}
