"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { useHomeTransactions } from "@/features/transactions/useHomeTransactions";
import { toTransactionItems } from "@/features/transactions/viewModels";
import { formatCents } from "@/lib/money";
import { progressColor } from "@/lib/progress";
import AddAccountButton from "./AddAccountButton";
import TransactionItem from "./TransactionItem";
import TransactionsSummary from "./TransactionsSummary";

function MonthlyLimit({ spent, limit }: { spent: number; limit: number }) {
  const raw = Math.floor((spent / limit) * 100);
  return (
    <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3.5">
      <div className="mb-2 flex items-baseline justify-between gap-3 text-[13px]">
        <span className="text-white/55">Limite mensal de gastos</span>
        <span className="font-semibold tabular-nums text-white">{formatCents(limit)}</span>
      </div>
      <div role="progressbar" aria-label="Limite mensal usado" aria-valuenow={Math.min(raw, 100)} aria-valuemin={0} aria-valuemax={100} className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, raw))}%`, background: progressColor(raw) }} />
      </div>
      <p className="mt-2 text-[12px] text-white/45">{raw >= 100 ? `Limite ultrapassado em ${formatCents(spent - limit)}` : `${raw}% usado · restam ${formatCents(limit - spent)}`}</p>
    </div>
  );
}

const sectionTitle = "text-[20px] font-semibold tracking-tight text-white";

/** Início: resumo do mês e últimas transações, com os mesmos componentes da página Transações. */
export default function RecentTransactionsSection() {
  const router = useRouter();
  const { data, error, reload } = useHomeTransactions();

  if (!data && error) {
    return <section className="mx-auto mt-8 w-full max-w-[460px] px-4"><ErrorState onRetry={reload} /></section>;
  }
  if (!data) return null;

  return (
    <>
      <section aria-label="Resumo do mês" className="mx-auto mt-8 w-full max-w-[460px] px-4">
        <h2 className={`${sectionTitle} mb-4`}>Resumo do mês</h2>
        <TransactionsSummary income={data.incomeCents / 100} expenses={data.expenseCents / 100} />
        {data.monthlyLimitCents > 0 && <MonthlyLimit spent={data.expenseCents} limit={data.monthlyLimitCents} />}
      </section>

      <section aria-label="Transações recentes" className="mx-auto mt-8 w-full max-w-[460px] px-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className={sectionTitle}>Transações recentes</h2>
          {data.total > 0 && (
            <Link href="/transacoes" className="flex items-center gap-1 text-[14px] text-white/45 transition hover:text-white/70 active:opacity-60">
              Ver Todas
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
            </Link>
          )}
        </div>
        {data.total === 0 ? (
          <EmptyState
            icon={<><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>}
            title="Você ainda não adicionou transações."
            action={<AddAccountButton label="Adicionar primeira transação" onClick={() => router.push("/transacoes/nova")} />}
          />
        ) : data.recent.length === 0 ? (
          <p className="px-1 text-[14px] text-white/45">Nada lançado até hoje. As próximas aparecem aqui quando chegarem.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {toTransactionItems(data.recent, data.lookups).map((tx) => (
              <TransactionItem key={tx.id} tx={tx} onSelect={(id) => router.push(`/transacoes?ver=${encodeURIComponent(id)}`)} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
