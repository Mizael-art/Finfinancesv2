import { addDays, addMonths, clampedDate, parseISODate } from "@/lib/date";
import type { Recurrence, RecurrenceFrequency } from "@/types/domain";

type ScheduleInput = Pick<Recurrence, "frequency" | "dayOfMonth" | "startDate" | "endDate" | "lastGeneratedDate">;

/** Quantas ocorrências no máximo uma única execução gera (evita travar após anos fechado). */
export const MAX_PER_RUN = 500;

/**
 * Datas em que a recorrência cai, de `startDate` até `until` (inclusive), ignorando o que já
 * foi gerado (`lastGeneratedDate`) e respeitando `endDate`. Tudo em datas de calendário.
 *
 * - diária / semanal: a cada 1 / 7 dias a partir de `startDate`.
 * - mensal: no `dayOfMonth` de cada mês (dia 31 em fevereiro cai no último dia).
 * - anual: no mesmo dia e mês de `startDate` (29/02 cai em 28/02 nos anos comuns).
 */
export function occurrencesUpTo(rec: ScheduleInput, until: string): string[] {
  const limit = rec.endDate && rec.endDate < until ? rec.endDate : until;
  const out: string[] = [];
  const push = (d: string) => {
    if (d >= rec.startDate && (!rec.lastGeneratedDate || d > rec.lastGeneratedDate)) out.push(d);
  };

  const start = parseISODate(rec.startDate);
  const [sy, sm, sd] = [start.getFullYear(), start.getMonth() + 1, start.getDate()];

  for (let k = 0; out.length < MAX_PER_RUN; k++) {
    let date: string;
    switch (rec.frequency) {
      case "diaria": date = addDays(rec.startDate, k); break;
      case "semanal": date = addDays(rec.startDate, 7 * k); break;
      case "mensal": {
        const total = sy * 12 + (sm - 1) + k;
        date = clampedDate(Math.floor(total / 12), (total % 12) + 1, rec.dayOfMonth);
        break;
      }
      case "anual": date = clampedDate(sy + k, sm, sd); break;
    }
    if (date > limit) break;
    push(date);
  }
  return out;
}

/** Próxima data depois de `date` para uma recorrência criada a partir de uma transação lançada nesse dia. */
export function nextOccurrence(frequency: RecurrenceFrequency, date: string): string {
  switch (frequency) {
    case "diaria": return addDays(date, 1);
    case "semanal": return addDays(date, 7);
    case "mensal": return addMonths(date, 1);
    case "anual": return addMonths(date, 12);
  }
}
