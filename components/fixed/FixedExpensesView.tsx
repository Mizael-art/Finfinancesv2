"use client";

import { useEffect, useMemo, useState } from "react";
import AddAccountButton from "@/components/finance/AddAccountButton";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Toast from "@/components/ui/Toast";
import { groupByDueMonth, nextDueDate } from "@/features/fixed/nextDue";
import { FREQUENCY_ADVERB } from "@/features/transactions/constants";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useToast } from "@/hooks/useToast";
import { monthKey, monthName, todayISODate } from "@/lib/date";
import { formatCents } from "@/lib/money";
import { getServices } from "@/services";
import type { Recurrence } from "@/types/domain";
import FixedExpenseFormSheet from "./FixedExpenseFormSheet";

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando despesas fixas" className="flex flex-col gap-3">
      <div className="h-[110px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] motion-reduce:animate-none" />
      {[0, 1, 2].map((i) => <div key={i} className="h-[72px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] motion-reduce:animate-none" />)}
    </div>
  );
}

/** Despesas que se repetem (aluguel, internet, assinaturas): ver, criar, editar, pausar e excluir. */
export default function FixedExpensesView() {
  const [form, setForm] = useState<{ key: number; id?: string } | null>(null);
  const toast = useToast();
  // Vindo do botão "+" ("/fixas?nova=1"): abre o formulário de nova despesa assim que os dados chegam.
  const [wantNew, setWantNew] = useState(false);
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).get("nova")) return;
    setWantNew(true);
    window.history.replaceState(null, "", "/fixas");
  }, []);
  const { data, error, reload } = useLiveQuery(async () => {
    const s = getServices();
    const [recurrences, categories, accounts, cards] = await Promise.all([s.recurrences.list(), s.categories.list(), s.accounts.list(), s.cards.list()]);
    return { recurrences, categories, accounts, cards };
  }, []);

  const view = useMemo(() => {
    if (!data) return null;
    const expenses = data.recurrences.filter((r) => r.type === "despesa").sort((a, b) => a.dayOfMonth - b.dayOfMonth || a.description.localeCompare(b.description, "pt-BR"));
    const expenseCats = data.categories.filter((c) => c.kind === "despesa").sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    const catName = new Map(data.categories.map((c) => [c.id, c.name]));
    const accName = new Map(data.accounts.map((a) => [a.id, a.name]));
    const cardName = new Map(data.cards.map((c) => [c.id, c.name]));
    const active = expenses.filter((r) => r.active);
    const monthlyTotal = active.filter((r) => r.frequency === "mensal").reduce((sum, r) => sum + r.amountCents, 0);
    // Pelo mês do próximo vencimento: o que já foi lançado neste mês passa para o mês seguinte sozinho.
    const today = todayISODate();
    const currentKey = monthKey(today);
    const entries = active.map((recurrence) => ({ recurrence, next: nextDueDate(recurrence, today) }));
    const groups = groupByDueMonth(entries);
    const pendingCents = entries.filter((e) => e.next && monthKey(e.next) === currentKey).reduce((sum, e) => sum + e.recurrence.amountCents, 0);
    return { expenses, active, paused: expenses.filter((r) => !r.active), expenseCats, catName, accName, cardName, monthlyTotal, currentKey, groups, pendingCents };
  }, [data]);

  useEffect(() => {
    if (wantNew && data) { setForm({ key: Date.now() }); setWantNew(false); }
  }, [wantNew, data]);

  const editing = form?.id ? data?.recurrences.find((r) => r.id === form.id) : undefined;
  const openNew = () => setForm({ key: Date.now() });

  const row = (r: Recurrence) => {
    const v = view!;
    const hasCategory = !!r.categoryId && v.catName.has(r.categoryId);
    const where = r.cardId ? `Cartão ${v.cardName.get(r.cardId) ?? ""}` : r.accountId ? v.accName.get(r.accountId) : "Conta principal";
    const sub = [hasCategory ? v.catName.get(r.categoryId!) : null, where].filter(Boolean).join(" · ");
    return (
      <li key={r.id}>
        <button type="button" onClick={() => setForm({ key: Date.now(), id: r.id })} className={`flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3 text-left transition active:scale-[0.99] hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 ${r.active ? "" : "opacity-55"}`}>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-center leading-none">
            <span>
              <span className="block text-[10px] font-medium uppercase text-white/45">{r.frequency === "mensal" ? "dia" : "rep."}</span>
              <span className="block text-[16px] font-semibold tabular-nums text-white">{r.frequency === "mensal" ? r.dayOfMonth : "↻"}</span>
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-white">{r.description}</span>
            <span className="block truncate text-[13px] text-white/45">{r.frequency !== "mensal" ? `Se repete ${FREQUENCY_ADVERB[r.frequency]} · ` : ""}{sub}</span>
            {!hasCategory && r.active && <span className="mt-0.5 block text-[12px] font-medium text-amber-300">Escolha uma categoria para lançar sozinha</span>}
            {!r.active && <span className="mt-0.5 block text-[12px] font-medium text-white/50">Pausada</span>}
          </span>
          <span className="shrink-0 text-[15px] font-semibold tabular-nums text-white">{formatCents(r.amountCents)}</span>
        </button>
      </li>
    );
  };

  let body;
  if (!data && error) body = <ErrorState onRetry={reload} />;
  else if (!view) body = <Skeleton />;
  else if (view.expenses.length === 0) {
    body = (
      <EmptyState
        icon={<><path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></>}
        title="Nenhuma despesa fixa ainda."
        description="Cadastre aluguel, internet, assinaturas... O FinFinance lança tudo sozinho todo mês."
        action={<AddAccountButton label="Nova despesa fixa" onClick={openNew} />}
      />
    );
  } else {
    body = (
      <>
        <section aria-label="Total mensal" className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-5 py-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-white/40">Total fixo por mês</p>
          <p className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight text-white">{formatCents(view.monthlyTotal)}</p>
          <p className="text-[13px] text-white/45">{view.active.length} {view.active.length === 1 ? "despesa ativa" : "despesas ativas"}</p>
          {view.active.length > 0 && (
            <p className={`mt-3 border-t border-white/[0.06] pt-3 text-[13px] ${view.pendingCents > 0 ? "text-white/70" : "text-ok"}`}>
              {view.pendingCents > 0 ? `Ainda vence em ${monthName(view.currentKey)}: ${formatCents(view.pendingCents)}` : `Contas de ${monthName(view.currentKey)} em dia — mostrando as próximas.`}
            </p>
          )}
        </section>
        {view.groups.map((g) => (
          <section key={g.key} aria-label={g.key} className="mt-5">
            <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wide text-white/40">
              {g.key === "sem" ? "Sem próximo vencimento" : g.key === view.currentKey ? `Ainda em ${monthName(g.key)}` : `${monthName(g.key)} ${g.key.slice(0, 4)}`}
            </p>
            <ul className="flex flex-col gap-2.5">{g.items.map((e) => row(e.recurrence))}</ul>
          </section>
        ))}
        {view.paused.length > 0 && (
          <>
            <p className="mb-2 mt-6 text-[12px] font-semibold uppercase tracking-wide text-white/40">Pausadas</p>
            <ul className="flex flex-col gap-2.5">{view.paused.map(row)}</ul>
          </>
        )}
        <div className="mt-5 flex justify-center"><AddAccountButton label="Nova despesa fixa" onClick={openNew} /></div>
      </>
    );
  }

  return (
    <main className="min-h-dvh pb-28">
      <div className="mx-auto w-full max-w-[460px] px-4 pt-6">
        <header className="mb-5">
          <h1 className="text-[26px] font-semibold tracking-tight text-white">Despesas fixas</h1>
          <p className="mt-1 text-[13px] text-white/45">Contas que se repetem e são lançadas sozinhas.</p>
        </header>
        {body}
      </div>
      {form && data && view && (form.id ? editing : true) && (
        <FixedExpenseFormSheet key={form.key} expense={editing} categories={view.expenseCats} accounts={data.accounts} cards={data.cards} onClose={() => setForm(null)} onDone={toast.show} />
      )}
      <Toast message={toast.message} />
    </main>
  );
}
