"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import CategoryDonutChart from "@/components/finance/CategoryDonutChart";
import MonthComparisonChart from "@/components/finance/MonthComparisonChart";
import PeriodSelector from "@/components/finance/PeriodSelector";
import TopExpensesList from "@/components/finance/TopExpensesList";
import TransactionsSummary from "@/components/finance/TransactionsSummary";
import PeriodSheet from "@/components/transactions/PeriodSheet";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { useReportsData } from "@/features/reports/useReportsData";
import { changeSentence, comparisonLabels, toDonutSlices, toTopItems } from "@/features/reports/viewModels";
import { useFirstDay } from "@/features/settings/useSettingsData";
import { PERIODS, rangeFor, type PeriodId } from "@/features/transactions/periods";
import { todayISODate } from "@/lib/date";
import { fromCents } from "@/lib/money";

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-2.5 mt-6 px-1 text-[13px] font-semibold uppercase tracking-wide text-white/35">{children}</p>
);

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando relatórios" className="flex flex-col gap-3">
      <div className="h-[74px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] motion-reduce:animate-none" />
      <div className="h-[260px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] motion-reduce:animate-none" />
      <div className="h-[200px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] motion-reduce:animate-none" />
    </div>
  );
}

/** Relatórios reais: resumo, gastos por categoria, comparação com o período anterior e maiores despesas. */
export default function ReportsView() {
  const today = useMemo(() => todayISODate(), []);
  const [periodId, setPeriodId] = useState<PeriodId>("mes");
  const [periodOpen, setPeriodOpen] = useState(false);
  const firstDay = useFirstDay();
  const range = useMemo(() => rangeFor(periodId, today, firstDay), [periodId, today, firstDay]);
  const { data, error, reload } = useReportsData(range);
  const period = PERIODS.find((p) => p.id === periodId)!;

  let body;
  if (!data && error) body = <ErrorState onRetry={reload} />;
  else if (!data) body = <Skeleton />;
  else if (data.count === 0) {
    body = (
      <EmptyState
        icon={<><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></>}
        title={periodId === "tudo" ? "Você ainda não possui transações." : "Sem movimentações neste período."}
        description={periodId === "tudo" ? "Registre receitas e despesas para ver seus relatórios." : "Escolha outro período ou registre uma transação."}
        action={<Link href="/transacoes/nova" className="inline-grid h-11 place-items-center rounded-lg bg-violet-500 hover:bg-violet-600 px-5 text-[14px] font-semibold text-white">+ Nova transação</Link>}
      />
    );
  } else {
    const labels = comparisonLabels(range, data.previous?.range);
    const sentence = data.previous ? changeSentence(data.expenseCents, data.previous.expenseCents) : null;
    body = (
      <>
        {error && <div className="mb-4"><ErrorState title="Não foi possível atualizar" onRetry={reload} /></div>}
        <TransactionsSummary income={fromCents(data.incomeCents)} expenses={fromCents(data.expenseCents)} />

        <Label>Gastos por categoria</Label>
        {data.categories.length === 0 ? (
          <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-[14px] text-white/50">Nenhuma despesa neste período.</p>
        ) : (
          <CategoryDonutChart data={toDonutSlices(data.categories)} total={fromCents(data.expenseCents)} />
        )}

        {labels && data.previous && (
          <>
            <Label>Comparação com o período anterior</Label>
            <MonthComparisonChart
              previous={{ label: labels.previous, amount: fromCents(data.previous.expenseCents) }}
              current={{ label: labels.current, amount: fromCents(data.expenseCents) }}
            />
            {sentence && <p className="mt-2 px-1 text-center text-[12px] text-white/45" role="status">{sentence}</p>}
          </>
        )}

        {data.top.length > 0 && (
          <>
            <Label>Destaques</Label>
            <TopExpensesList items={toTopItems(data.top)} />
          </>
        )}
      </>
    );
  }

  return (
    <main className="min-h-dvh pb-28">
      <div className="mx-auto w-full max-w-[460px] px-4 pt-6">
        <header className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-[26px] font-semibold tracking-tight text-white">Relatórios</h1>
          <PeriodSelector label={period.short} onClick={() => setPeriodOpen(true)} />
        </header>
        {body}
      </div>
      {periodOpen && <PeriodSheet value={periodId} onSelect={setPeriodId} onClose={() => setPeriodOpen(false)} />}
    </main>
  );
}
