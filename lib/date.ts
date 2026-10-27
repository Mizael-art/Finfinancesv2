const dayFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long" });
const timeFmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** "27 de setembro" */
/**
 * Rótulo do dia na lista: "Hoje", "Ontem" ou "27 de setembro".
 * Aceita data de calendário ("YYYY-MM-DD", sem fuso) e, por compatibilidade, data-hora ISO.
 */
export const formatDayLabel = (iso: string, today: string = todayISODate()) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    if (iso === today) return "Hoje";
    if (iso === addDays(today, -1)) return "Ontem";
    const label = dayFmt.format(parseISODate(iso));
    return iso.slice(0, 4) === today.slice(0, 4) ? label : `${label} de ${iso.slice(0, 4)}`;
  }
  const d = new Date(iso);
  const now = new Date();
  const yest = new Date();
  yest.setDate(now.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, now)) return "Hoje";
  if (sameDay(d, yest)) return "Ontem";
  return dayFmt.format(d);
};

export const formatTime = (iso: string) => timeFmt.format(new Date(iso));

/** Agrupa transações por dia, mantendo a ordem (mais recente primeiro). */
export function groupByDay<T extends { date: string }>(items: T[], today?: string) {
  const groups: { label: string; items: T[] }[] = [];
  for (const item of items) {
    const label = formatDayLabel(item.date, today);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

/* ------------------------------------------------------------------------
 * Datas de calendário ("YYYY-MM-DD") — sem fuso.
 *
 * `new Date("2026-09-28")` é interpretado como UTC e, no Brasil (UTC-3), vira
 * 27/09 à noite: o famoso "um dia a menos". Estas funções montam a data no
 * fuso LOCAL e nunca passam por UTC.
 * ---------------------------------------------------------------------- */

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Date local -> "YYYY-MM-DD" (usa os campos locais, não toISOString). */
export const toISODate = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** "YYYY-MM-DD" -> Date local à meia-noite. Lança se a data não existir (ex.: 2026-02-30). */
export function parseISODate(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new RangeError(`Data inválida: "${iso}"`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    throw new RangeError(`Data inexistente: "${iso}"`);
  }
  return date;
}

export const isValidISODate = (iso: string): boolean => {
  try {
    parseISODate(iso);
    return true;
  } catch {
    return false;
  }
};

/** Hoje no calendário do usuário (fuso local). */
export const todayISODate = (): string => toISODate(new Date());

/** Instante atual em ISO UTC, para `createdAt`/`updatedAt`. */
let lastStamp = 0;
/**
 * Instante atual em ISO UTC, para `createdAt`/`updatedAt`.
 * Nunca repete um valor: registros criados no mesmo milissegundo (ex.: várias contas do onboarding)
 * ficam em ordem estável de criação em vez de dependerem da ordem interna do banco.
 */
export const nowISO = (): string => {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return new Date(lastStamp).toISOString();
};

/** "YYYY-MM" de uma data. */
export const monthKey = (iso: string): string => iso.slice(0, 7);

export const daysInMonth = (year: number, month1to12: number): number => new Date(year, month1to12, 0).getDate();

/** Monta "YYYY-MM-DD" ajustando o dia ao tamanho do mês (dia 31 em fevereiro => 28/29). */
export function clampedDate(year: number, month1to12: number, day: number): string {
  return `${year}-${pad2(month1to12)}-${pad2(Math.min(day, daysInMonth(year, month1to12)))}`;
}

/** Soma meses preservando o dia quando possível (31/01 + 1 mês = 28/02 ou 29/02). */
export function addMonths(iso: string, months: number): string {
  const d = parseISODate(iso);
  const total = d.getFullYear() * 12 + d.getMonth() + months;
  return clampedDate(Math.floor(total / 12), (total % 12 + 12) % 12 + 1, d.getDate());
}

export const startOfMonth = (iso: string): string => `${iso.slice(0, 7)}-01`;
export const endOfMonth = (iso: string): string => {
  const d = parseISODate(iso);
  return clampedDate(d.getFullYear(), d.getMonth() + 1, 31);
};

/** Compara datas "YYYY-MM-DD" (a ordem lexicográfica já é a cronológica). */
export const isBetween = (iso: string, from: string, to: string): boolean => iso >= from && iso <= to;

const longDateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
const shortDateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

/** "28 de setembro de 2026" */
export const formatLongDate = (iso: string): string => longDateFmt.format(parseISODate(iso));
/** "28/09/2026" */
export const formatShortDate = (iso: string): string => shortDateFmt.format(parseISODate(iso));

/** Soma dias a uma data de calendário ("YYYY-MM-DD"), sem passar por UTC. */
export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** "2026-10" ou "2026-10-05" -> "Outubro/2026". */
export function formatMonthLabel(isoOrKey: string): string {
  const [y, m] = isoOrKey.split("-");
  return `${MONTH_NAMES[Number(m) - 1]}/${y}`;
}

/** "Outubro" (só o nome do mês) de "YYYY-MM[-DD]". */
export const monthName = (isoOrKey: string): string => MONTH_NAMES[Number(isoOrKey.split("-")[1]) - 1];

/** "05/10" (dia/mês) de "YYYY-MM-DD", sem passar por UTC. */
export const formatDayMonth = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
/** "21/10/2026 07:16" no fuso do aparelho, a partir de um instante ISO (ex.: `lastBackupAt`). Inválido = "". */
export function formatDateTime(isoInstant: string): string {
  const d = new Date(isoInstant);
  return Number.isNaN(d.getTime()) ? "" : dateTimeFmt.format(d).replace(",", "");
}
