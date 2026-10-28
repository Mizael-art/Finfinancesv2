"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import AddAccountButton from "@/components/finance/AddAccountButton";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { PLAN_GROUP_LABEL, PLAN_GROUP_ORDER, buildPlan, type PlanMonth } from "@/features/planning/projection";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { addDays, formatDayMonth, monthKey, monthName, todayISODate } from "@/lib/date";
import { formatCents } from "@/lib/money";
import { getServices } from "@/services";

const HORIZONS = [3, 6, 12] as const;
const MAX_ROWS = 8;

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando planejamento" className="flex flex-col gap-3">
      {[0, 1, 2, 3].map((i) => <div key={i} className="h-[112px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] motion-reduce:animate-none" />)}
    </div>
  );
}

const tone = (cents: number) => (cents < 0 ? "text-bad" : "text-ok");

/** Planejamento futuro: o que já está previsto para o resto do mês e para os próximos meses. */
export default function PlanningView() {
  const router = useRouter();
  const [months, setMonths] = useState<(typeof HORIZONS)[number]>(6);
  const [open, setOpen] = useState<string | null | undefined>(undefined);

  const { data, error, reload } = useLiveQuery(async () => {
    const s = getServices();
    const today = todayISODate();
    const [transactions, recurrences, incomes] = await Promise.all([s.transactions.list({ from: addDays(today, 1) }), s.recurrences.list(), s.income.list()]);
    return { today, transactions, recurrences, incomes };
  }, []);

  // Quando as contas do mês atual já passaram (nada mais a vencer nele), começa direto pelo mês seguinte.
  const plan = useMemo(() => {
    if (!data) return null;
    const currentKey = monthKey(data.today);
    return buildPlan({ ...data, months }).filter((m) => !(m.key === currentKey && m.items.length === 0));
  }, [data, months]);
  const sum = useMemo(() => {
    if (!plan) return null;
    const income = plan.reduce((s, m) => s + m.incomeCents, 0);
    const expense = plan.reduce((s, m) => s + m.expenseCents, 0);
    return { income, expense, balance: income - expense, empty: plan.every((m) => m.items.length === 0) };
  }, [plan]);

  const maxExpense = plan ? Math.max(1, ...plan.map((m) => m.expenseCents)) : 1;
  const openKey = open === undefined ? plan?.find((m) => m.items.length > 0)?.key ?? null : open;

  const card = (m: PlanMonth) => {
    const isOpen = openKey === m.key;
    const current = !!data && m.key === monthKey(data.today);
    const title = current ? `Ainda em ${monthName(m.key)}` : `${monthName(m.key)} ${m.key.slice(0, 4)}`;
    const base = m.incomeCents > 0 ? m.incomeCents : maxExpense;
    const pct = Math.min(100, Math.round((m.expenseCents / base) * 100));
    const over = m.incomeCents > 0 && m.expenseCents > m.incomeCents;
    return (
      <li key={m.key} className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03]">
        <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : m.key)} className="w-full px-4 py-3.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400">
          <span className="flex items-center justify-between">
            <span className="text-[16px] font-semibold text-white">{title}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`text-white/45 transition-transform ${isOpen ? "rotate-180" : ""}`}><path d="M6 9l6 6 6-6" /></svg>
          </span>
          <span className="mt-2.5 grid grid-cols-3 gap-2">
            <span className="min-w-0">
              <span className="block text-[11px] uppercase tracking-wide text-white/40">Despesas</span>
              <span className="block truncate text-[15px] font-semibold tabular-nums text-white">{formatCents(m.expenseCents)}</span>
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] uppercase tracking-wide text-white/40">Receitas</span>
              <span className="block truncate text-[15px] font-semibold tabular-nums text-white/80">{formatCents(m.incomeCents)}</span>
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] uppercase tracking-wide text-white/40">Sobra</span>
              <span className={`block truncate text-[15px] font-semibold tabular-nums ${m.incomeCents > 0 || m.expenseCents > 0 ? tone(m.balanceCents) : "text-white/40"}`}>{formatCents(m.balanceCents)}</span>
            </span>
          </span>
          <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-white/[0.08]" aria-hidden>
            <span className={`block h-full rounded-full ${over ? "bg-bad" : "bg-violet-400"}`} style={{ width: `${pct}%` }} />
          </span>
        </button>
        {isOpen && (
          <div className="border-t border-white/[0.06] px-4 py-3">
            {m.items.length === 0 ? (
              <p className="py-2 text-[13px] text-white/45">Nada previsto para este mês.</p>
            ) : (
              PLAN_GROUP_ORDER.filter((g) => m.items.some((i) => i.group === g)).map((g) => {
                const rows = m.items.filter((i) => i.group === g);
                return (
                  <section key={g} className="mb-3 last:mb-0">
                    <p className="mb-1.5 flex justify-between text-[12px] font-semibold uppercase tracking-wide text-white/40">
                      <span>{PLAN_GROUP_LABEL[g]}</span>
                      <span className="tabular-nums">{formatCents(m.byGroup[g])}</span>
                    </p>
                    <ul className="flex flex-col gap-1">
                      {rows.slice(0, MAX_ROWS).map((i) => (
                        <li key={i.id} className="flex items-baseline gap-2 text-[14px]">
                          <span className="w-10 shrink-0 tabular-nums text-white/40">{formatDayMonth(i.date)}</span>
                          <span className="min-w-0 flex-1 truncate text-white/85">{i.label}</span>
                          <span className={`shrink-0 tabular-nums ${g === "renda" ? "text-ok" : "text-white"}`}>{formatCents(i.cents)}</span>
                        </li>
                      ))}
                    </ul>
                    {rows.length > MAX_ROWS && <p className="mt-1 text-[12px] text-white/40">e mais {rows.length - MAX_ROWS} itens</p>}
                  </section>
                );
              })
            )}
          </div>
        )}
      </li>
    );
  };

  let body;
  if (!data && error) body = <ErrorState onRetry={reload} />;
  else if (!plan || !sum) body = <Skeleton />;
  else if (sum.empty) {
    body = (
      <EmptyState
        icon={<><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></>}
        title="Nada previsto ainda."
        description="Cadastre despesas fixas, parcele compras no cartão ou informe sua renda para ver os próximos meses."
        action={<AddAccountButton label="Cadastrar despesa fixa" onClick={() => router.push("/fixas?nova=1")} />}
      />
    );
  } else {
    body = (
      <>
        <section aria-label="Resumo" className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-5 py-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-white/40">Previsto até {monthName(plan[plan.length - 1].key)} {plan[plan.length - 1].key.slice(0, 4)}</p>
          <p className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight text-white">{formatCents(sum.expense)}</p>
          <p className="text-[13px] text-white/45">em despesas já previstas</p>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-3">
            <div><p className="text-[11px] uppercase tracking-wide text-white/40">Receitas previstas</p><p className="text-[15px] font-semibold tabular-nums text-white/80">{formatCents(sum.income)}</p></div>
            <div><p className="text-[11px] uppercase tracking-wide text-white/40">Sobra prevista</p><p className={`text-[15px] font-semibold tabular-nums ${tone(sum.balance)}`}>{formatCents(sum.balance)}</p></div>
          </div>
        </section>
        <ul className="mt-4 flex flex-col gap-2.5">{plan.map(card)}</ul>
        <p className="mt-5 text-[12px] leading-relaxed text-white/35">
          A previsão usa o que já está cadastrado: despesas fixas, parcelas e compras com data futura, receitas que se repetem e rendas fixas. Gastos do dia a dia que ainda não aconteceram não entram.
        </p>
      </>
    );
  }

  return (
    <main className="min-h-dvh pb-28">
      <div className="mx-auto w-full max-w-[460px] px-4 pt-6">
        <header className="mb-4">
          <h1 className="text-[26px] font-semibold tracking-tight text-white">Planejamento</h1>
          <p className="mt-1 text-[13px] text-white/45">O que já está previsto para os próximos meses.</p>
        </header>
        <div role="group" aria-label="Quantos meses mostrar" className="mb-4 grid grid-cols-3 gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
          {HORIZONS.map((h) => (
            <button key={h} type="button" aria-pressed={months === h} onClick={() => setMonths(h)} className={`h-10 rounded-lg text-[14px] font-medium transition ${months === h ? "bg-white/[0.12] text-white" : "text-white/50 hover:text-white/80"}`}>
              {h} meses
            </button>
          ))}
        </div>
        {body}
      </div>
    </main>
  );
}
