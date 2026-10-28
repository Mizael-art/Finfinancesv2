/** Leitura de extratos (OFX e CSV) no próprio aparelho: nada é enviado para lugar nenhum. */

export interface ParsedRow {
  date: string; // YYYY-MM-DD
  description: string;
  /** Com sinal: positivo entra dinheiro, negativo sai (como veio no arquivo). */
  cents: number;
}

export interface ParseResult {
  format: "ofx" | "csv" | "desconhecido";
  rows: ParsedRow[];
  /** Linhas que não deu para entender (sem data ou sem valor). */
  ignored: number;
  error?: string;
}

export const MAX_ROWS = 2000;

const strip = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** "1.234,56", "1234.56", "-R$ 12,30", "(45,00)" → centavos com sinal; null se não for número. */
export function parseAmount(raw: string): number | null {
  let t = raw.trim().replace(/R\$\s*/i, "").replace(/\s/g, "");
  if (!t) return null;
  let neg = /^\(.*\)$/.test(t);
  if (neg) t = t.slice(1, -1);
  if (t.startsWith("-") || t.endsWith("-")) neg = true;
  t = t.replace(/[-+]/g, "");
  if (!/^[\d.,]+$/.test(t)) return null;
  const lastComma = t.lastIndexOf(",");
  const lastDot = t.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    t = lastComma > lastDot ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (lastComma >= 0) {
    t = /,.*,/.test(t) ? t.replace(/,/g, "") : t.replace(",", ".");
  } else if (lastDot >= 0 && /\..*\./.test(t)) {
    t = t.replace(/\./g, ""); // 1.234.567 = milhares
  }
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  const cents = Math.round(n * 100);
  return neg ? -cents : cents;
}

const validDate = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

/** "27/10/2026", "27-10-26", "2026-10-27", "20261027" → "2026-10-27"; null se não for data. */
export function parseDate(raw: string): string | null {
  const t = raw.trim();
  let y: number, m: number, d: number;
  let r: RegExpExecArray | null;
  if ((r = /^(\d{4})-(\d{2})-(\d{2})/.exec(t))) [y, m, d] = [+r[1], +r[2], +r[3]];
  else if ((r = /^(\d{2})[/.-](\d{2})[/.-](\d{4})/.exec(t))) [d, m, y] = [+r[1], +r[2], +r[3]];
  else if ((r = /^(\d{2})[/.-](\d{2})[/.-](\d{2})$/.exec(t))) [d, m, y] = [+r[1], +r[2], 2000 + +r[3]];
  else if ((r = /^(\d{4})(\d{2})(\d{2})/.exec(t))) [y, m, d] = [+r[1], +r[2], +r[3]];
  else return null;
  if (!validDate(y, m, d)) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/* ---------------------------------- OFX ---------------------------------- */

function parseOfx(text: string): ParseResult {
  const rows: ParsedRow[] = [];
  let ignored = 0;
  for (const block of text.split(/<STMTTRN>/i).slice(1)) {
    const end = block.search(/<\/STMTTRN>/i);
    const body = end >= 0 ? block.slice(0, end) : block;
    const tag = (name: string) => new RegExp(`<${name}>\\s*([^<\\r\\n]*)`, "i").exec(body)?.[1]?.trim() ?? "";
    const date = parseDate(tag("DTPOSTED"));
    const cents = parseAmount(tag("TRNAMT"));
    if (!date || cents === null || cents === 0) { ignored++; continue; }
    rows.push({ date, cents, description: tag("MEMO") || tag("NAME") || tag("PAYEE") || "Sem descrição" });
  }
  return { format: "ofx", rows: rows.slice(0, MAX_ROWS), ignored };
}

/* ---------------------------------- CSV ---------------------------------- */

/** Divide em linhas e colunas respeitando aspas (campos com o separador ou quebra de linha dentro). */
export function splitCsv(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

function detectDelimiter(text: string): string {
  const head = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 6).join("\n").replace(/"[^"]*"/g, "");
  const counts: [string, number][] = [[";", (head.match(/;/g) ?? []).length], ["\t", (head.match(/\t/g) ?? []).length], [",", (head.match(/,/g) ?? []).length]];
  return counts.sort((a, b) => b[1] - a[1])[0][0];
}

interface Columns { date: number; desc: number[]; amount: number; debit: number; credit: number }

function mapHeader(cells: string[]): Columns | null {
  const cols: Columns = { date: -1, desc: [], amount: -1, debit: -1, credit: -1 };
  cells.forEach((raw, i) => {
    const h = strip(raw);
    if (cols.date < 0 && /^(data|date|dt)\b/.test(h)) cols.date = i;
    else if (/descri|histor|estabelecimento|memo|title|titulo|detalhe|^nome|lancamento$/.test(h)) cols.desc.push(i);
    else if (cols.amount < 0 && /^(valor|amount|value|quantia)/.test(h)) cols.amount = i;
    else if (cols.debit < 0 && /debito|saida/.test(h)) cols.debit = i;
    else if (cols.credit < 0 && /credito|entrada/.test(h)) cols.credit = i;
  });
  const hasValue = cols.amount >= 0 || (cols.debit >= 0 && cols.credit >= 0);
  return cols.date >= 0 && hasValue ? cols : null;
}

/** Sem cabeçalho: descobre as colunas pelo conteúdo (a que parece data, a que parece valor, o resto é descrição). */
function guessColumns(rows: string[][]): Columns | null {
  const sample = rows.slice(0, 20);
  const width = Math.max(...sample.map((r) => r.length));
  let date = -1, amount = -1;
  for (let c = 0; c < width; c++) {
    const cells = sample.map((r) => r[c] ?? "").filter((x) => x.trim());
    if (cells.length === 0) continue;
    if (date < 0 && cells.filter((x) => parseDate(x)).length / cells.length >= 0.7) date = c;
    else if (amount < 0 && cells.filter((x) => parseAmount(x) !== null && /\d/.test(x)).length / cells.length >= 0.7 && !cells.every((x) => parseDate(x))) amount = c;
  }
  if (date < 0 || amount < 0) return null;
  const desc: number[] = [];
  let best = -1, bestLen = 0;
  for (let c = 0; c < width; c++) {
    if (c === date || c === amount) continue;
    const len = sample.reduce((s, r) => s + (r[c]?.length ?? 0), 0);
    if (len > bestLen) { best = c; bestLen = len; }
  }
  if (best >= 0) desc.push(best);
  return { date, desc, amount, debit: -1, credit: -1 };
}

function parseCsv(text: string): ParseResult {
  const rows = splitCsv(text, detectDelimiter(text));
  if (rows.length === 0) return { format: "csv", rows: [], ignored: 0 };
  let cols: Columns | null = null;
  let start = 0;
  for (let i = 0; i < Math.min(rows.length, 15) && !cols; i++) {
    const m = mapHeader(rows[i]);
    if (m) { cols = m; start = i + 1; }
  }
  if (!cols) cols = guessColumns(rows);
  if (!cols) return { format: "csv", rows: [], ignored: rows.length, error: "Não consegui identificar as colunas de data e valor nesse arquivo." };

  const out: ParsedRow[] = [];
  let ignored = 0;
  for (const r of rows.slice(start)) {
    const date = parseDate(r[cols.date] ?? "");
    let cents: number | null = null;
    if (cols.amount >= 0) cents = parseAmount(r[cols.amount] ?? "");
    else {
      const deb = parseAmount(r[cols.debit] ?? "") ?? 0;
      const cred = parseAmount(r[cols.credit] ?? "") ?? 0;
      cents = Math.abs(cred) - Math.abs(deb);
    }
    if (!date || cents === null || cents === 0) { ignored++; continue; }
    const parts = [...new Set(cols.desc.map((i) => (r[i] ?? "").trim()).filter(Boolean))];
    out.push({ date, cents, description: (parts.join(" - ") || "Sem descrição").slice(0, 120) });
  }
  return { format: "csv", rows: out.slice(0, MAX_ROWS), ignored };
}

/** Lê o texto de um extrato. Reconhece OFX pelo conteúdo e CSV (`,` `;` ou tab, com ou sem cabeçalho). */
export function parseStatement(raw: string): ParseResult {
  const text = raw.replace(/^\uFEFF/, "");
  const result = /<OFX>|<STMTTRN>/i.test(text) ? parseOfx(text) : parseCsv(text);
  if (result.rows.length === 0 && !result.error) result.error = "Não encontrei lançamentos nesse arquivo.";
  return result;
}
