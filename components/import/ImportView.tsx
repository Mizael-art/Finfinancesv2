"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { Field, PrimaryButton, Select } from "@/components/ui/FormControls";
import Toast from "@/components/ui/Toast";
import { transactionsToCsv } from "@/features/importing/exportCsv";
import { parseStatement, type ParseResult } from "@/features/importing/parse";
import { saveTextFile } from "@/features/importing/saveFile";
import { suggestCategory } from "@/features/transactions/suggest";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useToast } from "@/hooks/useToast";
import { addMonths, endOfMonth, startOfMonth, todayISODate } from "@/lib/date";
import { formatCents } from "@/lib/money";
import { getServices } from "@/services";
import type { NewEntity, Transaction } from "@/types/domain";

const brDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** Bancos brasileiros às vezes exportam em Latin-1: tenta UTF-8 e, se der erro, lê como Windows-1252. */
async function readFileText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); }
  catch { return new TextDecoder("windows-1252").decode(buf); }
}

const card = "rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-4";
const sectionTitle = "text-[12px] font-semibold uppercase tracking-wide text-white/40";

/** Importar extrato (CSV/OFX) para uma conta ou cartão e exportar as transações em CSV. */
export default function ImportView() {
  const toast = useToast();
  const { data, error, reload } = useLiveQuery(async () => {
    const s = getServices();
    const today = todayISODate();
    const [accounts, cards, categories, history] = await Promise.all([s.accounts.list(), s.cards.list(), s.categories.list(), s.transactions.list({ from: addMonths(startOfMonth(today), -24) })]);
    return { today, accounts, cards, categories, history };
  }, []);

  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [dest, setDest] = useState("");
  const [invert, setInvert] = useState(false);
  const [defaultCat, setDefaultCat] = useState("");
  const [toggled, setToggled] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ done: number; failed: number } | null>(null);
  const [period, setPeriod] = useState<"mes" | "passado" | "ano" | "tudo">("mes");

  const destination = dest || (data?.accounts[0] ? `a:${data.accounts[0].id}` : data?.cards[0] ? `c:${data.cards[0].id}` : "");
  const toCard = destination.startsWith("c:");

  const existing = useMemo(() => {
    const set = new Set<string>();
    for (const t of data?.history ?? []) if (t.type === "despesa" || t.type === "receita") set.add(`${t.cardId ? `c:${t.cardId}` : `a:${t.accountId}`}|${t.date}|${t.amountCents}|${t.type}`);
    return set;
  }, [data]);

  const rows = useMemo(() => {
    if (!parsed || !data) return [];
    const catIds = new Set(data.categories.map((c) => c.id));
    return parsed.rows.map((r, i) => {
      const signed = invert ? -r.cents : r.cents;
      const type: "receita" | "despesa" = signed > 0 ? "receita" : "despesa";
      const cents = Math.abs(signed);
      const blocked = toCard && type === "receita"; // pagamento ou estorno no cartão não vira lançamento
      const duplicate = existing.has(`${destination}|${r.date}|${cents}|${type}`);
      const sg = suggestCategory(data.history, r.description, type);
      const categoryId = sg && catIds.has(sg.categoryId) ? sg.categoryId : type === "despesa" && defaultCat ? defaultCat : undefined;
      const on = !blocked && !duplicate;
      return { i, date: r.date, description: r.description, type, cents, blocked, duplicate, categoryId, selected: blocked ? false : toggled.has(i) ? !on : on };
    });
  }, [parsed, data, invert, toCard, destination, existing, defaultCat, toggled]);

  const chosen = rows.filter((r) => r.selected);
  const catName = (id?: string) => data?.categories.find((c) => c.id === id)?.name;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setResult(null); setToggled(new Set());
    setFileName(file.name);
    try { setParsed(parseStatement(await readFileText(file))); }
    catch { setParsed({ format: "desconhecido", rows: [], ignored: 0, error: "Não consegui abrir esse arquivo." }); }
  };

  const doImport = async () => {
    if (busy || chosen.length === 0) return;
    setBusy(true);
    const s = getServices().transactions;
    let done = 0, failed = 0;
    for (const r of chosen) {
      const input: NewEntity<Transaction> = {
        type: r.type, amountCents: r.cents, description: r.description, date: r.date, categoryId: r.categoryId,
        accountId: toCard ? undefined : destination.slice(2), cardId: toCard ? destination.slice(2) : undefined,
      };
      try { await s.create(input); done++; } catch { failed++; }
    }
    setBusy(false);
    setResult({ done, failed });
    setParsed(null); setFileName(""); setToggled(new Set());
  };

  const doExport = async () => {
    if (!data) return;
    const y = data.today.slice(0, 4);
    const lastMonth = addMonths(startOfMonth(data.today), -1);
    const range = period === "mes" ? { from: startOfMonth(data.today), to: endOfMonth(data.today) }
      : period === "passado" ? { from: lastMonth, to: endOfMonth(lastMonth) }
      : period === "ano" ? { from: `${y}-01-01`, to: `${y}-12-31` } : {};
    const s = getServices();
    const txs = await s.transactions.list(range);
    if (txs.length === 0) { toast.show("Nenhuma transação nesse período."); return; }
    await saveTextFile(`FinFinance_transacoes_${period}_${data.today}.csv`, transactionsToCsv(txs, data), "text/csv");
    toast.show(`${txs.length} ${txs.length === 1 ? "transação exportada" : "transações exportadas"}.`);
  };

  let body;
  if (!data && error) body = <ErrorState onRetry={reload} />;
  else if (!data) body = <div aria-busy="true" aria-label="Carregando" className="h-40 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] motion-reduce:animate-none" />;
  else {
    const canImport = data.accounts.length + data.cards.length > 0;
    const dupCount = rows.filter((r) => r.duplicate).length;
    body = (
      <>
        <section aria-label="Importar" className={card}>
          <p className={sectionTitle}>Importar extrato</p>
          {!canImport ? (
            <div className="mt-3"><EmptyState icon={<><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M3 10h18" /></>} title="Adicione uma conta antes." description="O extrato precisa saber em qual conta ou cartão entrar." action={<Link href="/contas" className="inline-grid h-11 place-items-center rounded-lg bg-violet-500 px-5 text-[14px] font-semibold text-white">Ir para Contas</Link>} /></div>
          ) : (
            <div className="mt-3 flex flex-col gap-4">
              <p className="text-[13px] leading-relaxed text-white/50">Baixe o extrato (CSV ou OFX) no app ou no site do seu banco e escolha o arquivo aqui. Ele é lido no seu aparelho; nada é enviado para a internet.</p>
              <Field label="Onde lançar">
                <Select value={destination} onChange={(e) => { setDest(e.target.value); setToggled(new Set()); }}>
                  {data.accounts.map((a) => <option key={a.id} value={`a:${a.id}`}>Conta · {a.name}</option>)}
                  {data.cards.map((c) => <option key={c.id} value={`c:${c.id}`}>Cartão · {c.name}</option>)}
                </Select>
              </Field>
              <div>
                <input id="extrato" type="file" accept=".csv,.ofx,.qfx,.txt,text/csv,text/plain" className="sr-only" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
                <label htmlFor="extrato" className="flex h-12 w-full cursor-pointer items-center justify-center rounded-lg bg-violet-500 text-[15px] font-semibold text-white transition active:scale-[0.98] hover:bg-violet-600 focus-within:outline focus-within:outline-2 focus-within:outline-violet-400">
                  {fileName ? "Escolher outro arquivo" : "Escolher arquivo"}
                </label>
                {fileName && <p className="mt-2 truncate text-[12px] text-white/40">{fileName}</p>}
              </div>

              {parsed?.error && <p role="alert" className="rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-[13px] text-bad-soft">{parsed.error}</p>}

              {result && (
                <div role="status" className="rounded-lg border border-ok/30 bg-ok/10 px-4 py-3 text-[14px] text-ok">
                  {result.done} {result.done === 1 ? "lançamento importado" : "lançamentos importados"}{result.failed > 0 ? `, ${result.failed} não puderam ser importados` : ""}.{" "}
                  <Link href="/transacoes" className="font-semibold underline">Ver transações</Link>
                </div>
              )}

              {parsed && parsed.rows.length > 0 && (
                <>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input type="checkbox" checked={invert} onChange={(e) => { setInvert(e.target.checked); setToggled(new Set()); }} className="mt-0.5 h-5 w-5 shrink-0 accent-violet-500" />
                    <span>
                      <span className="block text-[14px] font-medium text-white">Inverter entradas e saídas</span>
                      <span className="block text-[12px] text-white/45">Use se as compras aparecerem como receita (comum em fatura de cartão).</span>
                    </span>
                  </label>
                  <Field label="Categoria padrão das despesas sem sugestão">
                    <Select value={defaultCat} onChange={(e) => setDefaultCat(e.target.value)}>
                      <option value="">Sem categoria</option>
                      {data.categories.filter((c) => c.kind === "despesa").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                  </Field>
                  <p className="text-[13px] text-white/55">
                    {parsed.rows.length} {parsed.rows.length === 1 ? "lançamento encontrado" : "lançamentos encontrados"}
                    {dupCount > 0 ? ` · ${dupCount} possível${dupCount > 1 ? "is duplicados" : " duplicado"} (desmarcado${dupCount > 1 ? "s" : ""})` : ""}
                    {parsed.ignored > 0 ? ` · ${parsed.ignored} linha${parsed.ignored > 1 ? "s" : ""} ignorada${parsed.ignored > 1 ? "s" : ""}` : ""}
                  </p>
                  <ul className="flex max-h-[420px] flex-col gap-1.5 overflow-y-auto rounded-lg border border-white/[0.06] p-1.5">
                    {rows.map((r) => (
                      <li key={r.i}>
                        <label className={`flex items-center gap-3 rounded-lg px-2.5 py-2 ${r.blocked ? "opacity-45" : "cursor-pointer hover:bg-white/[0.04]"}`}>
                          <input type="checkbox" checked={r.selected} disabled={r.blocked} onChange={() => setToggled((t) => { const n = new Set(t); if (n.has(r.i)) n.delete(r.i); else n.add(r.i); return n; })} className="h-5 w-5 shrink-0 accent-violet-500" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] text-white">{r.description}</span>
                            <span className="block truncate text-[12px] text-white/40">
                              {brDay(r.date)}{catName(r.categoryId) ? ` · ${catName(r.categoryId)}` : ""}{r.duplicate ? " · possível duplicado" : ""}{r.blocked ? " · pagamento/estorno do cartão (ignorado)" : ""}
                            </span>
                          </span>
                          <span className={`shrink-0 text-[14px] font-semibold tabular-nums ${r.type === "receita" ? "text-ok" : "text-white"}`}>{r.type === "receita" ? "+" : "−"} {formatCents(r.cents)}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <PrimaryButton disabled={busy || chosen.length === 0} onClick={() => void doImport()}>
                    {busy ? "Importando…" : chosen.length === 0 ? "Nenhum lançamento selecionado" : `Importar ${chosen.length} ${chosen.length === 1 ? "lançamento" : "lançamentos"}`}
                  </PrimaryButton>
                </>
              )}
            </div>
          )}
        </section>

        <section aria-label="Exportar" className={`${card} mt-4`}>
          <p className={sectionTitle}>Exportar transações</p>
          <p className="mb-4 mt-3 text-[13px] leading-relaxed text-white/50">Gera uma planilha (CSV) para abrir no Excel ou no Google Planilhas, ou para guardar uma cópia.</p>
          <Field label="Período">
            <Select value={period} onChange={(e) => setPeriod(e.target.value as typeof period)}>
              <option value="mes">Este mês</option>
              <option value="passado">Mês passado</option>
              <option value="ano">Este ano</option>
              <option value="tudo">Tudo</option>
            </Select>
          </Field>
          <div className="mt-4"><PrimaryButton onClick={() => void doExport()}>Exportar CSV</PrimaryButton></div>
        </section>
      </>
    );
  }

  return (
    <main className="min-h-dvh pb-28">
      <div className="mx-auto w-full max-w-[460px] px-4 pt-6">
        <header className="mb-5">
          <h1 className="text-[26px] font-semibold tracking-tight text-white">Importar e exportar</h1>
          <p className="mt-1 text-[13px] text-white/45">Traga o extrato do banco ou leve seus dados para uma planilha.</p>
        </header>
        {body}
      </div>
      <Toast message={toast.message} />
    </main>
  );
}
