"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import AddAccountButton from "@/components/finance/AddAccountButton";
import FilterChips from "@/components/finance/FilterChips";
import NewTransactionFab from "@/components/finance/NewTransactionFab";
import PeriodSelector from "@/components/finance/PeriodSelector";
import SearchBar from "@/components/finance/SearchBar";
import TransactionsList from "@/components/finance/TransactionsList";
import TransactionsSummary from "@/components/finance/TransactionsSummary";
import BottomNavigation from "@/components/ui/BottomNavigation";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { SecondaryButton } from "@/components/ui/FormControls";
import Toast from "@/components/ui/Toast";
import { useFirstDay } from "@/features/settings/useSettingsData";
import { PERIODS, rangeFor, type PeriodId } from "@/features/transactions/periods";
import { useTransactionsData } from "@/features/transactions/useTransactionsData";
import { toTransactionItems } from "@/features/transactions/viewModels";
import { useToast } from "@/hooks/useToast";
import { todayISODate } from "@/lib/date";
import { filterTransactions, summarizeTransactions } from "@/services/transactions/rules";
import type { TransactionType } from "@/types/domain";
import PeriodSheet from "./PeriodSheet";
import TransactionDetailSheet from "./TransactionDetailSheet";

const FILTERS = ["Todas", "Receitas", "Despesas", "Transferências"];
const FILTER_TYPE: (TransactionType | undefined)[] = [undefined, "receita", "despesa", "transferencia"];

function ListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando transações" className="flex flex-col gap-2">
      {[0, 1, 2, 3].map((i) => <div key={i} className="h-[68px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] motion-reduce:animate-none" />)}
    </div>
  );
}

const plusIcon = <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>;

export default function TransactionsView() {
  const router = useRouter();
  const today = useMemo(() => todayISODate(), []);
  const [periodId, setPeriodId] = useState<PeriodId>("mes");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [filter, setFilter] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const toast = useToast();

  const firstDay = useFirstDay();
  const range = useMemo(() => rangeFor(periodId, today, firstDay), [periodId, today, firstDay]);
  const { data, error, reload } = useTransactionsData(range);

  // Vindo do Início ("/transacoes?ver=ID"): abre os detalhes dessa transação, em qualquer período.
  const [pendingId, setPendingId] = useState<string | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("ver");
    if (!id) return;
    setPeriodId("tudo");
    setPendingId(id);
    window.history.replaceState(null, "", "/transacoes");
    const t = window.setTimeout(() => setPendingId(null), 4000);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (pendingId && data?.transactions.some((t) => t.id === pendingId)) {
      setSelectedId(pendingId);
      setPendingId(null);
    }
  }, [pendingId, data]);

  const selected = data?.transactions.find((t) => t.id === selectedId);
  const goNew = () => router.push("/transacoes/nova");

  let body;
  if (!data && error) body = <ErrorState onRetry={reload} />;
  else if (!data) body = <ListSkeleton />;
  else if (data.total === 0) {
    body = (
      <EmptyState
        icon={plusIcon}
        title="Você ainda não possui transações."
        description="Registre receitas, despesas e transferências para acompanhar seu dinheiro."
        action={<AddAccountButton label="Nova transação" onClick={goNew} />}
      />
    );
  } else {
    const summary = summarizeTransactions(data.transactions);
    const filtered = filterTransactions(data.transactions, { type: FILTER_TYPE[filter], search: query });
    const items = toTransactionItems(filtered, data);
    const periodLabel = PERIODS.find((p) => p.id === periodId)!.label.toLowerCase();

    body = (
      <>
        {error && <div className="mb-4"><ErrorState title="Não foi possível atualizar" onRetry={reload} /></div>}
        <div className="mb-4">
          <TransactionsSummary income={summary.incomeCents / 100} expenses={summary.expenseCents / 100} />
        </div>
        <div className="mb-4"><SearchBar value={query} onChange={setQuery} /></div>
        <div className="mb-5"><FilterChips active={filter} onSelect={setFilter} /></div>

        {data.transactions.length === 0 ? (
          <EmptyState
            icon={plusIcon}
            title={`Nenhuma transação em ${periodLabel}.`}
            description="Troque o período para ver o restante do seu histórico."
            action={<div className="w-56"><SecondaryButton onClick={() => setPeriodId("tudo")}>Ver todo o período</SecondaryButton></div>}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></>}
            title="Nada encontrado."
            description="Nenhuma transação combina com a busca ou o filtro escolhido."
            action={<div className="w-48"><SecondaryButton onClick={() => { setQuery(""); setFilter(0); }}>Limpar filtros</SecondaryButton></div>}
          />
        ) : (
          <TransactionsList items={items} onSelect={setSelectedId} />
        )}
      </>
    );
  }

  return (
    <main className="min-h-dvh pb-28">
      <div className="mx-auto w-full max-w-[460px] px-4 pt-6">
        <header className="mb-5 flex items-center justify-between">
          <h1 className="text-[26px] font-semibold tracking-tight text-white">Transações</h1>
          <PeriodSelector label={PERIODS.find((p) => p.id === periodId)!.short} onClick={() => setPeriodOpen(true)} />
        </header>
        {body}
        <div className="fixed bottom-24 right-4 z-30 lg:bottom-8 lg:right-8">
          <NewTransactionFab />
        </div>
      </div>
      <BottomNavigation />
      {periodOpen && <PeriodSheet value={periodId} onSelect={setPeriodId} onClose={() => setPeriodOpen(false)} />}
      {selected && data && <TransactionDetailSheet key={selected.id} tx={selected} lookups={data} onClose={() => setSelectedId(null)} onDone={toast.show} />}
      <Toast message={toast.message} />
    </main>
  );
}
