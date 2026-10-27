import { THEME_IDS } from "@/features/theme/themes";
import { isValidISODate } from "@/lib/date";
import { STORE_NAMES } from "@/storage/schema";
import type { StoreMap, StoreName } from "@/storage/types";

/** Identifica o arquivo e a versão do formato. Só sobe quando o formato muda de forma incompatível. */
export const BACKUP_APP = "FinFinance";
export const BACKUP_FORMAT = 1;
export const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
const MAX_ERRORS = 5;

export type BackupData = { [K in StoreName]: StoreMap[K][] };

export interface BackupFile {
  app: typeof BACKUP_APP;
  format: number;
  exportedAt: string;
  counts: Record<StoreName, number>;
  data: BackupData;
}

export type InspectResult =
  | { ok: true; file: BackupFile; counts: Record<StoreName, number>; warnings: string[] }
  | { ok: false; error: string };

type Rec = Record<string, unknown>;
const isObj = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => typeof v === "string" && v.trim() !== "";
const int = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const date = (v: unknown) => typeof v === "string" && isValidISODate(v);
const optDate = (v: unknown) => v === undefined || date(v);
const oneOf = (v: unknown, list: readonly string[]) => typeof v === "string" && list.includes(v);

/** Campos mínimos de cada store (o resto é preservado como veio). Devolve o nome do campo inválido ou null. */
const CHECKS: Record<StoreName, (r: Rec) => string | null> = {
  users: (r) => (!str(r.name) ? "nome" : null),
  settings: (r) =>
    r.id !== "settings" ? "id" : typeof r.onboardingCompleted !== "boolean" ? "onboardingCompleted" : !oneOf(r.theme, [...THEME_IDS, "escuro", "claro", "sistema"]) ? "tema" : !int(r.firstDayOfMonth, 1, 28) ? "primeiro dia do mês" : null,
  accounts: (r) => (!str(r.name) ? "nome" : !str(r.type) ? "tipo" : !int(r.initialBalanceCents, -Number.MAX_SAFE_INTEGER) ? "saldo inicial" : null),
  transactions: (r) =>
    !oneOf(r.type, ["receita", "despesa", "transferencia", "pagamento_fatura"]) ? "tipo" : !int(r.amountCents, 1) ? "valor" : !date(r.date) ? "data" : typeof r.description !== "string" ? "descrição" : null,
  cards: (r) => (!str(r.name) ? "nome" : !int(r.limitCents) ? "limite" : !int(r.closingDay, 1, 31) ? "dia de fechamento" : !int(r.dueDay, 1, 31) ? "dia de vencimento" : null),
  invoices: (r) => (!str(r.cardId) ? "cartão" : !str(r.referenceKey) ? "referência" : !date(r.closingDate) ? "fechamento" : !date(r.dueDate) ? "vencimento" : null),
  categories: (r) => (!str(r.name) ? "nome" : !oneOf(r.kind, ["receita", "despesa"]) ? "tipo" : null),
  budgets: (r) => (!str(r.categoryId) ? "categoria" : !int(r.limitCents, 1) ? "limite" : null),
  goals: (r) => (!str(r.name) ? "nome" : !int(r.targetCents, 1) ? "valor da meta" : !int(r.currentCents) ? "valor guardado" : !optDate(r.deadline) ? "prazo" : null),
  incomeSources: (r) => (!str(r.name) ? "nome" : !int(r.amountCents) ? "valor" : !int(r.payDay, 1, 31) ? "dia" : null),
  recurrences: (r) =>
    !oneOf(r.type, ["receita", "despesa"]) ? "tipo" : !str(r.description) ? "descrição" : !int(r.amountCents, 1) ? "valor" : !int(r.dayOfMonth, 1, 31) ? "dia" : !date(r.startDate) ? "início" : null,
  investments: (r) => (!str(r.name) ? "nome" : !int(r.investedCents) ? "valor investido" : !int(r.currentCents) ? "valor atual" : !date(r.date) ? "data" : null),
};

export const STORE_LABELS: Record<StoreName, string> = {
  users: "perfil", settings: "configurações", accounts: "contas", transactions: "transações", cards: "cartões", invoices: "faturas",
  categories: "categorias", budgets: "orçamentos", goals: "metas", incomeSources: "fontes de renda", recurrences: "recorrências", investments: "investimentos",
};

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export const emptyCounts = (): Record<StoreName, number> => Object.fromEntries(STORE_NAMES.map((n) => [n, 0])) as Record<StoreName, number>;

/**
 * Lê e valida o texto de um backup SEM tocar no banco. Só aceita o arquivo se tudo estiver coerente:
 * o objetivo é nunca restaurar dado quebrado por cima de dado bom.
 */
export function inspectBackup(text: string, opts: { bytes?: number } = {}): InspectResult {
  if ((opts.bytes ?? text.length) > MAX_BACKUP_BYTES) return { ok: false, error: "O arquivo é grande demais para ser um backup do FinFinance." };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, error: "Este arquivo não é um JSON válido." }; }
  if (!isObj(raw) || raw.app !== BACKUP_APP) return { ok: false, error: "Este arquivo não parece ser um backup do FinFinance." };
  if (typeof raw.format !== "number" || !Number.isInteger(raw.format) || raw.format < 1) return { ok: false, error: "O backup não informa a versão do formato." };
  if (raw.format > BACKUP_FORMAT) return { ok: false, error: "Este backup foi gerado por uma versão mais nova do FinFinance. Atualize o app para importá-lo." };
  if (!isObj(raw.data)) return { ok: false, error: "O backup não contém dados." };

  const data = {} as BackupData;
  const errors: string[] = [];
  const counts = emptyCounts();
  for (const store of STORE_NAMES) {
    const list = raw.data[store];
    if (list === undefined) { errors.push(`${cap(STORE_LABELS[store])}: faltam no arquivo.`); continue; }
    if (!Array.isArray(list)) { errors.push(`${cap(STORE_LABELS[store])}: formato inválido.`); continue; }
    const seen = new Set<string>();
    list.forEach((item, i) => {
      if (errors.length >= MAX_ERRORS) return;
      const where = `${cap(STORE_LABELS[store])} (item ${i + 1})`;
      if (!isObj(item)) { errors.push(`${where}: registro inválido.`); return; }
      if (!str(item.id)) { errors.push(`${where}: sem identificador.`); return; }
      if (seen.has(item.id as string)) { errors.push(`${where}: identificador repetido.`); return; }
      seen.add(item.id as string);
      if (!str(item.createdAt) || !str(item.updatedAt)) { errors.push(`${where}: sem datas de controle.`); return; }
      const bad = CHECKS[store](item);
      if (bad) errors.push(`${where}: ${bad} inválido(a).`);
    });
    (data[store] as unknown[]) = list;
    counts[store] = list.length;
  }
  if (errors.length > 0) return { ok: false, error: `O backup está corrompido ou incompleto. ${errors.slice(0, MAX_ERRORS).join(" ")}` };

  const warnings = referenceWarnings(data);
  const file: BackupFile = { app: BACKUP_APP, format: raw.format, exportedAt: typeof raw.exportedAt === "string" ? raw.exportedAt : "", counts, data };
  return { ok: true, file, counts, warnings };
}

/** Vínculos que apontam para algo que não está no arquivo. Não impede a importação (o app trata órfãos), mas avisa. */
export function referenceWarnings(data: BackupData): string[] {
  const ids = (list: { id: string }[]) => new Set(list.map((x) => x.id));
  const acc = ids(data.accounts), card = ids(data.cards), cat = ids(data.categories), inv = ids(data.invoices);
  let broken = 0;
  const miss = (id: unknown, set: Set<string>) => { if (typeof id === "string" && id && !set.has(id)) broken++; };
  for (const t of data.transactions) { miss(t.accountId, acc); miss(t.toAccountId, acc); miss(t.cardId, card); miss(t.categoryId, cat); miss(t.invoiceId, inv); }
  for (const b of data.budgets) miss(b.categoryId, cat);
  for (const i of data.invoices) miss(i.cardId, card);
  return broken > 0 ? [`${broken} vínculo(s) apontam para itens que não estão no arquivo (por exemplo, uma conta removida).`] : [];
}

/** Há dados do usuário (além de perfil, configurações e categorias padrão que nascem sozinhas)? Decide se restaurar "substitui" algo. */
export const hasUserData = (c: Record<StoreName, number>): boolean =>
  (["accounts", "cards", "transactions", "budgets", "goals", "recurrences", "incomeSources", "investments"] as StoreName[]).some((s) => c[s] > 0);
