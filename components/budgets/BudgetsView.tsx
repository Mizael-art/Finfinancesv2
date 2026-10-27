"use client";

import { useMemo, useState } from "react";
import AddAccountButton from "@/components/finance/AddAccountButton";
import BudgetCard from "@/components/finance/BudgetCard";
import BudgetsSummary from "@/components/finance/BudgetsSummary";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Toast from "@/components/ui/Toast";
import { useBudgetsData } from "@/features/budgets/useBudgetsData";
import { attentionCount, attentionSentence, toBudgetCard } from "@/features/budgets/viewModels";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useToast } from "@/hooks/useToast";
import { formatMonthLabel } from "@/lib/date";
import { addMonthKey, currentMonthKey, type MonthKey } from "@/lib/financialMonth";
import { todayISODate } from "@/lib/date";
import { formatCents } from "@/lib/money";
import { getServices } from "@/services";
import BudgetFormSheet from "./BudgetFormSheet";

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando orçamentos" className="flex flex-col gap-3">
      <div className="h-[170px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] motion-reduce:animate-none" />
      {[0, 1, 2].map((i) => <div key={i} className="h-[96px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] motion-reduce:animate-none" />)}
    </div>
  );
}

const Chevron = ({ dir }: { dir: "left" | "right" }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={dir === "left" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} />
  </svg>
);

/** Orçamentos reais por mês financeiro: gasto por categoria, criar, editar e excluir. */
export default function BudgetsView() {
  const [month, setMonth] = useState<MonthKey | null>(null); // null = mês atual
  const [form, setForm] = useState<{ key: number; id?: string } | null>(null);
  const toast = useToast();
  const { data, error, reload } = useBudgetsData(month);
  const cats = useLiveQuery(() => getServices().categories.list(), []);

  const shown = data?.month ?? month ?? currentMonthKey(todayISODate());
  const label = formatMonthLabel(shown);
  const items = data?.items ?? [];
  const budgeted = useMemo(() => new Set(items.map((i) => i.budget.categoryId)), [items]);
  const available = useMemo(
    () => (cats.data ?? []).filter((c) => c.kind === "despesa" && !budgeted.has(c.id)).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [cats.data, budgeted],
  );
  const editing = form?.id ? items.find((i) => i.budget.id === form.id) : undefined;
  const go = (n: number) => setMonth(addMonthKey(shown, n));
  const openNew = () => setForm({ key: Date.now() });

  let body;
  if (!data && error) body = <ErrorState onRetry={reload} />;
  else if (!data) body = <Skeleton />;
  else {
    body = (
      <>
        {error && <div className="mb-4"><ErrorState title="Não foi possível atualizar" onRetry={reload} /></div>}
        {items.length === 0 ? (
          <EmptyState
            icon={<><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>}
            title="Você ainda não possui orçamentos."
            description="Defina um limite mensal por categoria e acompanhe quanto já gastou."
            action={available.length > 0 ? <AddAccountButton label="Novo orçamento" onClick={openNew} /> : undefined}
          />
        ) : (
          <>
            <BudgetsSummary totalLimit={data.totalLimitCents / 100} totalSpent={data.totalSpentCents / 100} label={`Orçado em ${label.toLowerCase()}`} />
            <p className="mt-3 text-center text-[13px] text-white/45" role="status">{attentionSentence(attentionCount(items))}</p>
            <p className="mb-3 mt-5 text-[12px] font-semibold uppercase tracking-wide text-white/40">Por categoria</p>
            <ul className="flex flex-col gap-3">
              {items.map((i) => (
                <li key={i.budget.id}><BudgetCard budget={toBudgetCard(i, label)} onClick={() => setForm({ key: Date.now(), id: i.budget.id })} /></li>
              ))}
            </ul>
            {available.length > 0 && <div className="mt-5 flex justify-center"><AddAccountButton label="Novo orçamento" onClick={openNew} /></div>}
          </>
        )}

        {data.unbudgeted.length > 0 && (
          <section aria-label="Gastos sem orçamento" className="mt-6">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-white/40">Sem orçamento neste mês</p>
            <ul className="flex flex-col gap-2">
              {data.unbudgeted.map((u) => (
                <li key={u.category.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-[14px] text-white/70">{u.category.name}</span>
                  <span className="shrink-0 text-[14px] font-semibold tabular-nums text-white/80">{formatCents(u.spentCents)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </>
    );
  }

  return (
    <main className="min-h-dvh pb-28">
      <div className="mx-auto w-full max-w-[460px] px-4 pt-6">
        <header className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-[26px] font-semibold tracking-tight text-white">Orçamentos</h1>
          <div className="flex items-center gap-1" role="group" aria-label="Mês">
            <button type="button" onClick={() => go(-1)} aria-label="Mês anterior" className="grid h-11 w-11 place-items-center rounded-full text-white/70 transition active:scale-90 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"><Chevron dir="left" /></button>
            <span className="min-w-[118px] whitespace-nowrap text-center text-[14px] font-medium capitalize text-white" aria-live="polite">{label}</span>
            <button type="button" onClick={() => go(1)} aria-label="Próximo mês" className="grid h-11 w-11 place-items-center rounded-full text-white/70 transition active:scale-90 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"><Chevron dir="right" /></button>
          </div>
        </header>
        {body}
      </div>
      {form && data && (form.id ? editing : true) && (
        <BudgetFormSheet key={form.key} budget={editing?.budget} category={editing?.category} available={available} month={shown} onClose={() => setForm(null)} onDone={toast.show} />
      )}
      <Toast message={toast.message} />
    </main>
  );
}
