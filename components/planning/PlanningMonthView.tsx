"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ErrorState from "@/components/ui/ErrorState";
import { categoryBreakdown } from "@/features/planning/monthDetail";
import { PLAN_GROUP_LABEL, PLAN_GROUP_ORDER, type PlanGroup } from "@/features/planning/projection";
import { usePlanningData } from "@/features/planning/usePlanningData";
import { formatDayMonth, monthKey, monthName } from "@/lib/date";
import { formatCents } from "@/lib/money";

/** Quantos meses à frente dá para abrir (o mesmo máximo do Planejamento). */
const HORIZON = 12;

const tone = (cents: number) => (cents < 0 ? "text-bad" : "text-ok");
const box = "rounded-xl border border-white/[0.06] bg-white/[0.03]";
const sectionTitle = "mb-2 flex justify-between text-[12px] font-semibold uppercase tracking-wide text-white/40";
/** Receitas primeiro: dá para ver o que entra antes do que sai. */
const GROUPS: PlanGroup[] = ["renda", ...PLAN_GROUP_ORDER.filter((g) => g !== "renda")];

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando mês" className="flex flex-col gap-3">
      {[150, 120, 220].map((h, i) => <div key={i} style={{ height: h }} className="animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] motion-reduce:animate-none" />)}
    </div>
  );
}

function Arrow({ href, dir, label }: { href?: string; dir: "prev" | "next"; label: string }) {
  const icon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={dir === "prev" ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} /></svg>;
  const cls = "grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white transition";
  return href
    ? <Link href={href} aria-label={label} className={`${cls} active:scale-95 hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400`}>{icon}</Link>
    : <span aria-hidden className={`${cls} opacity-30`}>{icon}</span>;
}

/** Um mês do Planejamento por inteiro: resumo, saldo previsto das contas, gastos por categoria e todos os itens. */
export default function PlanningMonthView({ monthKey: key, initialEstimate }: { monthKey: string; initialEstimate: boolean }) {
  const [withEstimate, setWithEstimate] = useState(initialEstimate);
  const { data, error, reload, estimate, plan, balances, invoicesByMonth } = usePlanningData(HORIZON, withEstimate);

  const index = plan ? plan.findIndex((m) => m.key === key) : -1;
  const month = plan && index >= 0 ? plan[index] : null;
  const slices = useMemo(() => (month && data ? categoryBreakdown(month, data.categories) : []), [month, data]);
  const query = withEstimate ? "" : "?est=0";
  const hrefFor = (i: number) => (plan && plan[i] ? `/planejamento/${plan[i].key}${query}` : undefined);
  const current = !!data && key === monthKey(data.today);
  const title = `${monthName(key)} ${key.slice(0, 4)}`;

  let body;
  if (!data && error) body = <ErrorState onRetry={reload} />;
  else if (!plan || !data) body = <Skeleton />;
  else if (!month) {
    body = (
      <div className={`${box} px-5 py-6 text-center`}>
        <p className="text-[15px] font-semibold text-white">Esse mês está fora do planejamento.</p>
        <p className="mt-1 text-[13px] text-white/45">Dá para ver do mês atual até {HORIZON} meses à frente.</p>
        <Link href="/planejamento" className="mt-4 inline-block text-[14px] font-semibold text-violet-300 hover:text-violet-200">Voltar ao Planejamento</Link>
      </div>
    );
  } else {
    const bal = balances?.get(month.key);
    const invoices = invoicesByMonth?.get(month.key) ?? [];
    const maxSlice = Math.max(1, ...slices.map((s) => s.cents));
    body = (
      <>
        <section aria-label="Resumo do mês" className={`${box} px-5 py-4`}>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-white/40">{current ? "O que ainda falta neste mês" : "Previsto para o mês"}</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div className="min-w-0"><p className="text-[11px] uppercase tracking-wide text-white/40">Receitas</p><p className="truncate text-[16px] font-semibold tabular-nums text-white/85">{formatCents(month.incomeCents)}</p></div>
            <div className="min-w-0"><p className="text-[11px] uppercase tracking-wide text-white/40">Despesas</p><p className="truncate text-[16px] font-semibold tabular-nums text-white">{formatCents(month.expenseCents)}</p></div>
            <div className="min-w-0"><p className="text-[11px] uppercase tracking-wide text-white/40">Sobra</p><p className={`truncate text-[16px] font-semibold tabular-nums ${tone(month.balanceCents)}`}>{formatCents(month.balanceCents)}</p></div>
          </div>
          {month.incomeCents === 0 && (
            <p className="mt-3 border-t border-white/[0.06] pt-3 text-[13px] text-white/55">Nenhuma receita prevista. <Link href="/renda" className="font-medium text-violet-300 hover:text-violet-200">Informar salário</Link></p>
          )}
        </section>

        {bal && (
          <section aria-label="Saldo previsto das contas" className={`${box} mt-4 px-5 py-4`}>
            <p className={sectionTitle}><span>Saldo previsto nas contas</span></p>
            <div className="flex flex-col gap-1.5 text-[14px]">
              <p className="flex justify-between gap-2"><span className="text-white/55">{current ? "Hoje" : `Início de ${monthName(month.key)}`}</span><span className="tabular-nums text-white">{formatCents(bal.startCents)}</span></p>
              <p className="flex justify-between gap-2"><span className="text-white/55">Sobra prevista do mês</span><span className={`tabular-nums ${tone(month.balanceCents)}`}>{month.balanceCents >= 0 ? "+" : ""}{formatCents(month.balanceCents)}</span></p>
              {bal.cardDebtCents > 0 && (
                <p className="flex justify-between gap-2"><span className="text-white/55">Faturas de compras já feitas</span><span className="tabular-nums text-bad-soft">−{formatCents(bal.cardDebtCents)}</span></p>
              )}
              <p className="mt-1 flex justify-between gap-2 border-t border-white/[0.06] pt-2.5"><span className="font-semibold text-white">Fim de {monthName(month.key)}</span><span className={`text-[17px] font-semibold tabular-nums ${bal.endCents < 0 ? "text-bad" : "text-white"}`}>{formatCents(bal.endCents)}</span></p>
            </div>
            <p className="mt-2.5 text-[12px] leading-relaxed text-white/35">Soma de todas as contas. É uma estimativa: parte do saldo de hoje e soma o que está previsto mês a mês.</p>
          </section>
        )}

        {slices.length > 0 && (
          <section aria-label="Despesas por categoria" className={`${box} mt-4 px-5 py-4`}>
            <p className={sectionTitle}><span>Despesas por categoria</span><span className="tabular-nums">{formatCents(month.expenseCents)}</span></p>
            <ul className="flex flex-col gap-3">
              {slices.map((s) => (
                <li key={s.id}>
                  <p className="flex items-baseline justify-between gap-2 text-[14px]">
                    <span className="flex min-w-0 items-center gap-2">
                      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.estimate ? "rgba(255,255,255,0.35)" : s.color ?? "#9AA0A8" }} />
                      <span className={`truncate ${s.estimate ? "text-white/60" : "text-white/85"}`}>{s.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-white">{formatCents(s.cents)} <span className="text-[12px] text-white/40">{s.percent}%</span></span>
                  </p>
                  <span aria-hidden className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                    <span className="block h-full rounded-full" style={{ width: `${Math.max(2, Math.round((s.cents / maxSlice) * 100))}%`, background: s.estimate ? "rgba(255,255,255,0.3)" : s.color ?? "#9AA0A8" }} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-label="Tudo o que está previsto" className={`${box} mt-4 px-5 py-4`}>
          {month.items.length === 0 && invoices.length === 0 && month.variableCents === 0 ? (
            <p className="text-[13px] text-white/45">Nada previsto para este mês.</p>
          ) : (
            <>
              {GROUPS.filter((g) => month.items.some((i) => i.group === g)).map((g) => {
                const rows = month.items.filter((i) => i.group === g);
                return (
                  <div key={g} className="mb-4 last:mb-0">
                    <p className={sectionTitle}><span>{PLAN_GROUP_LABEL[g]} · {rows.length}</span><span className="tabular-nums">{formatCents(month.byGroup[g])}</span></p>
                    <ul className="flex flex-col gap-0.5">
                      {rows.map((i) => {
                        const inner = (
                          <>
                            <span className="w-11 shrink-0 tabular-nums text-white/40">{formatDayMonth(i.date)}</span>
                            <span className="min-w-0 flex-1 truncate text-white/85">{i.label}</span>
                            <span className={`shrink-0 tabular-nums ${g === "renda" ? "text-ok" : "text-white"}`}>{formatCents(i.cents)}</span>
                          </>
                        );
                        return (
                          <li key={i.id}>
                            {i.txId
                              ? <Link href={`/transacoes/${i.txId}/editar`} aria-label={`Abrir ${i.label} para editar ou apagar`} className="-mx-1.5 flex items-baseline gap-2 rounded-md px-1.5 py-1.5 text-[14px] transition hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400">{inner}</Link>
                              : <div className="flex items-baseline gap-2 py-1.5 text-[14px]">{inner}</div>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
              {month.variableCents > 0 && estimate && (
                <div className="mb-4 border-t border-white/[0.06] pt-3 last:mb-0">
                  <p className={sectionTitle}><span>Gastos do dia a dia (estimativa)</span><span className="tabular-nums">{formatCents(month.variableCents)}</span></p>
                  <p className="text-[12px] leading-relaxed text-white/35">Média dos últimos {estimate.monthsUsed} {estimate.monthsUsed === 1 ? "mês" : "meses"}: mercado, lanches, transporte e outros gastos que não são fixos nem parcelados.</p>
                </div>
              )}
              {invoices.length > 0 && (
                <div className="border-t border-white/[0.06] pt-3">
                  <p className={sectionTitle}><span>Faturas do cartão a pagar</span><span className="tabular-nums">{formatCents(invoices.reduce((s, v) => s + v.totalCents, 0))}</span></p>
                  <ul className="flex flex-col gap-0.5">
                    {invoices.map((v) => (
                      <li key={v.invoice.id}>
                        <Link href="/faturas" className="-mx-1.5 flex items-baseline gap-2 rounded-md px-1.5 py-1.5 text-[14px] transition hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400">
                          <span className="w-11 shrink-0 tabular-nums text-white/40">{formatDayMonth(v.invoice.dueDate)}</span>
                          <span className="min-w-0 flex-1 truncate text-white/85">Fatura {v.cardName}</span>
                          <span className="shrink-0 tabular-nums text-white">{formatCents(v.totalCents)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-[12px] leading-relaxed text-white/35">Para saber quando o dinheiro sai da conta. Não entram nas despesas do mês: as compras já contam no mês em que foram feitas.</p>
                </div>
              )}
            </>
          )}
        </section>

        {estimate && estimate.monthsUsed > 0 && (
          <label className={`${box} mt-4 flex cursor-pointer items-center justify-between gap-3 px-4 py-3`}>
            <span className="min-w-0">
              <span className="block text-[14px] font-medium text-white">Incluir gastos do dia a dia</span>
              <span className="block text-[12px] text-white/45">Estimativa de {formatCents(estimate.monthlyCents)} por mês.</span>
            </span>
            <input type="checkbox" checked={withEstimate} onChange={(e) => setWithEstimate(e.target.checked)} className="h-5 w-5 shrink-0 accent-violet-500" />
          </label>
        )}
      </>
    );
  }

  return (
    <main className="min-h-dvh pb-28">
      <div className="mx-auto w-full max-w-[460px] px-4 pt-6">
        <header className="mb-5 flex items-center gap-3">
          <Link href="/planejamento" aria-label="Voltar ao Planejamento" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white transition active:scale-95 hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></svg>
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-[24px] font-semibold tracking-tight text-white">{title}</h1>
          {month && (
            <div className="flex gap-2">
              <Arrow dir="prev" href={hrefFor(index - 1)} label={plan && plan[index - 1] ? `Ver ${monthName(plan[index - 1].key)}` : "Mês anterior"} />
              <Arrow dir="next" href={hrefFor(index + 1)} label={plan && plan[index + 1] ? `Ver ${monthName(plan[index + 1].key)}` : "Próximo mês"} />
            </div>
          )}
        </header>
        {body}
      </div>
    </main>
  );
}
