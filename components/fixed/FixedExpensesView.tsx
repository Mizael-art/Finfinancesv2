"use client";

import { useEffect, useMemo, useState } from "react";
import AddAccountButton from "@/components/finance/AddAccountButton";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Toast from "@/components/ui/Toast";
import { buildBillsView, type Bill } from "@/features/bills/bills";
import { nextDueDate } from "@/features/fixed/nextDue";
import { FREQUENCY_ADVERB } from "@/features/transactions/constants";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useToast } from "@/hooks/useToast";
import { formatDayMonth, monthName, todayISODate } from "@/lib/date";
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
    // Contas do mês (com "paguei"): o mês atual some quando tudo está pago e a lista segue para o mês seguinte.
    const today = todayISODate();
    const bills = buildBillsView(active, today);
    const shown = new Set([...(bills.showCurrent ? bills.current : []), ...bills.next].map((b) => b.recurrence.id));
    const later = active.filter((r) => !shown.has(r.id) && !(bills.currentPaidAll && bills.current.some((b) => b.recurrence.id === r.id))).map((r) => ({ recurrence: r, next: nextDueDate(r, today) }));
    return { expenses, active, paused: expenses.filter((r) => !r.active), expenseCats, catName, accName, cardName, monthlyTotal, bills, later };
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

  const togglePaid = (b: Bill) => {
    getServices().recurrences.setPaid(b.recurrence.id, b.dueDate, !b.paid)
      .then(() => toast.show(b.paid ? "Pagamento desfeito." : "Marcada como paga."))
      .catch(() => toast.show("Não foi possível atualizar agora."));
  };

  const billRow = (b: Bill) => {
    const v = view!;
    const r = b.recurrence;
    const hasCategory = !!r.categoryId && v.catName.has(r.categoryId);
    const where = r.cardId ? `Cartão ${v.cardName.get(r.cardId) ?? ""}` : r.accountId ? v.accName.get(r.accountId) : "Conta principal";
    const sub = [hasCategory ? v.catName.get(r.categoryId!) : null, where].filter(Boolean).join(" · ");
    const status = b.paid ? "Paga" : b.status === "atrasada" ? `Atrasada · ${formatDayMonth(b.dueDate)}` : b.status === "hoje" ? "Vence hoje" : `Vence ${formatDayMonth(b.dueDate)}`;
    const tone = b.paid ? "text-ok" : b.status === "atrasada" ? "text-bad-soft" : b.status === "hoje" ? "text-amber-300" : "text-white/50";
    return (
      <li key={b.key} className={`flex items-center rounded-xl border bg-white/[0.03] ${b.status === "atrasada" ? "border-bad/35" : "border-white/[0.06]"} ${b.paid ? "opacity-75" : ""}`}>
        <button type="button" onClick={() => setForm({ key: Date.now(), id: r.id })} className="flex min-w-0 flex-1 items-center gap-3 rounded-l-xl px-3.5 py-3 text-left transition active:scale-[0.99] hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-center leading-none">
            <span>
              <span className="block text-[10px] font-medium uppercase text-white/45">dia</span>
              <span className="block text-[16px] font-semibold tabular-nums text-white">{Number(b.dueDate.slice(8, 10))}</span>
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-[15px] font-semibold text-white ${b.paid ? "line-through decoration-white/30" : ""}`}>{r.description}</span>
            <span className={`block truncate text-[12.5px] font-medium ${tone}`}>{status}</span>
            <span className="block truncate text-[12px] text-white/40">{sub}</span>
            {!hasCategory && <span className="mt-0.5 block text-[12px] font-medium text-amber-300">Escolha uma categoria para lançar sozinha</span>}
          </span>
          <span className="shrink-0 text-[15px] font-semibold tabular-nums text-white">{formatCents(r.amountCents)}</span>
        </button>
        <button
          type="button"
          aria-pressed={b.paid}
          aria-label={b.paid ? `Desfazer pagamento de ${r.description} (${formatDayMonth(b.dueDate)})` : `Marcar ${r.description} (${formatDayMonth(b.dueDate)}) como paga`}
          onClick={() => togglePaid(b)}
          className={`mx-3 grid h-10 w-10 shrink-0 place-items-center rounded-full border transition active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 ${b.paid ? "border-ok/50 bg-ok/20 text-ok" : "border-white/[0.14] text-white/40 hover:text-white/80"}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
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
            <p className={`mt-3 border-t border-white/[0.06] pt-3 text-[13px] ${view.bills.pendingCount > 0 ? (view.bills.overdueCount > 0 ? "text-bad-soft" : "text-white/70") : view.bills.currentPaidAll ? "text-ok" : "text-white/45"}`}>
              {view.bills.pendingCount > 0
                ? `Falta pagar em ${monthName(view.bills.currentKey)}: ${formatCents(view.bills.pendingCents)} (${view.bills.pendingCount} ${view.bills.pendingCount === 1 ? "conta" : "contas"})${view.bills.overdueCount > 0 ? ` · ${view.bills.overdueCount} atrasada${view.bills.overdueCount > 1 ? "s" : ""}` : ""}`
                : view.bills.currentPaidAll ? `Contas de ${monthName(view.bills.currentKey)} pagas — mostrando as de ${monthName(view.bills.nextKey)}.` : `Nenhuma conta vence em ${monthName(view.bills.currentKey)}.`}
            </p>
          )}
        </section>
        {view.bills.showCurrent && (
          <section aria-label={`Contas de ${monthName(view.bills.currentKey)}`} className="mt-5">
            <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wide text-white/40">{monthName(view.bills.currentKey)} {view.bills.currentKey.slice(0, 4)}</p>
            <ul className="flex flex-col gap-2.5">{view.bills.current.map(billRow)}</ul>
          </section>
        )}
        {view.bills.next.length > 0 && (
          <section aria-label={`Contas de ${monthName(view.bills.nextKey)}`} className="mt-5">
            <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wide text-white/40">{monthName(view.bills.nextKey)} {view.bills.nextKey.slice(0, 4)}</p>
            <ul className="flex flex-col gap-2.5">{view.bills.next.map(billRow)}</ul>
          </section>
        )}
        {view.later.length > 0 && (
          <section aria-label="Outras repetições" className="mt-5">
            <p className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-wide text-white/40">Outras repetições</p>
            <ul className="flex flex-col gap-2.5">{view.later.map((e) => row(e.recurrence))}</ul>
          </section>
        )}
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
