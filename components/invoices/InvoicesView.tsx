"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import BottomNavigation from "@/components/ui/BottomNavigation";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Toast from "@/components/ui/Toast";
import { useCardsOverview } from "@/features/cards/useCardsOverview";
import { groupInvoices, summarizeInvoices } from "@/features/invoices/viewModels";
import { useToast } from "@/hooks/useToast";
import { formatLongDate } from "@/lib/date";
import { formatCents } from "@/lib/money";
import InvoiceDetailSheet from "./InvoiceDetailSheet";
import InvoiceRow from "./InvoiceRow";

const receiptIcon = <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>;

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando faturas" className="flex flex-col gap-2.5">
      {[0, 1, 2].map((i) => <div key={i} className="h-[72px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] motion-reduce:animate-none" />)}
    </div>
  );
}

function Group({ title, children, count }: { title: string; children: React.ReactNode; count: number }) {
  if (count === 0) return null;
  return (
    <section className="mb-6" aria-label={title}>
      <p className="mb-2.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-white/35">{title}</p>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

function Collapsible({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (count === 0) return null;
  return (
    <section className="mb-6" aria-label={title}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="mb-2.5 flex w-full items-center justify-between px-1 text-[13px] font-semibold uppercase tracking-wide text-white/35 hover:text-white/55">
        <span>{title} ({count})</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`transition ${open ? "rotate-180" : ""}`} aria-hidden><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && <div className="flex flex-col gap-2.5">{children}</div>}
    </section>
  );
}

/** Faturas de todos os cartões: o que pagar, o que está aberto, o que é futuro e o histórico. */
export default function InvoicesView() {
  const { data, error, reload } = useCardsOverview();
  const params = useSearchParams();
  const cardFilter = params.get("cartao") ?? "";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const toast = useToast();

  const views = useMemo(() => (data ? data.views.filter((v) => !cardFilter || v.cardId === cardFilter) : []), [data, cardFilter]);
  const groups = useMemo(() => groupInvoices(views), [views]);
  const summary = useMemo(() => summarizeInvoices(views), [views]);
  const selected = data?.views.find((v) => v.invoice.id === selectedId);
  const cardOfSelected = selected && data?.cards.find((c) => c.id === selected.cardId);

  let body;
  if (!data && error) body = <ErrorState onRetry={reload} />;
  else if (!data) body = <Skeleton />;
  else if (data.cards.length === 0) {
    body = (
      <EmptyState
        icon={<><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 10h18" /></>}
        title="Adicione seu primeiro cartão."
        description="As faturas aparecem aqui assim que você registrar compras no cartão."
        action={<Link href="/cartoes" className="inline-grid h-11 place-items-center rounded-lg bg-violet-500 hover:bg-violet-600 px-5 text-[14px] font-semibold text-white">Ir para Cartões</Link>}
      />
    );
  } else if (data.views.length === 0) {
    body = (
      <EmptyState
        icon={receiptIcon}
        title="Você ainda não possui faturas."
        description="Registre uma compra no cartão e a fatura é criada sozinha, no ciclo certo."
        action={<Link href="/transacoes/nova" className="inline-grid h-11 place-items-center rounded-lg bg-violet-500 hover:bg-violet-600 px-5 text-[14px] font-semibold text-white">+ Nova transação</Link>}
      />
    );
  } else {
    body = (
      <>
        {error && <div className="mb-4"><ErrorState title="Não foi possível atualizar" onRetry={reload} /></div>}

        {data.cards.length > 1 && (
          <div role="group" aria-label="Filtrar por cartão" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[{ id: "", name: "Todos" }, ...data.cards.map((c) => ({ id: c.id, name: c.name }))].map((c) => (
              <Link key={c.id || "todos"} href={c.id ? `/faturas?cartao=${c.id}` : "/faturas"} replace scroll={false} aria-current={cardFilter === c.id ? "true" : undefined}
                className={`h-9 shrink-0 rounded-full border px-4 text-[13px] font-semibold leading-9 transition ${cardFilter === c.id ? "border-violet-400/40 bg-violet-500/20 text-white" : "border-white/[0.08] bg-white/[0.03] text-white/55 hover:text-white/80"}`}>
                {c.name}
              </Link>
            ))}
          </div>
        )}

        <section aria-label="Resumo das faturas" className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
          <p className="text-[12px] text-white/45">A pagar</p>
          <p className={`mt-0.5 truncate text-[28px] font-semibold tabular-nums tracking-tight ${summary.overdueCents > 0 ? "text-bad-soft" : "text-white"}`}>{formatCents(summary.toPayCents)}</p>
          <p className="mt-1 text-[12px] text-white/45">
            {summary.nextDue ? `Próximo vencimento: ${summary.nextDue.cardName}, ${formatLongDate(summary.nextDue.dueDate)}` : "Nenhuma fatura fechada para pagar."}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <div className="min-w-0 rounded-lg bg-white/[0.04] px-3 py-2"><p className="text-[11px] text-white/45">Atrasadas</p><p className={`truncate text-[14px] font-bold tabular-nums ${summary.overdueCents > 0 ? "text-bad-soft" : "text-white"}`}>{formatCents(summary.overdueCents)}</p></div>
            <div className="min-w-0 rounded-lg bg-white/[0.04] px-3 py-2"><p className="text-[11px] text-white/45">Em aberto</p><p className="truncate text-[14px] font-bold tabular-nums text-white">{formatCents(summary.openCents)}</p></div>
          </div>
        </section>

        {views.length === 0 ? (
          <EmptyState icon={receiptIcon} title="Esse cartão ainda não tem faturas." description="Registre uma compra nele para criar a primeira." />
        ) : (
          <>
            <Group title="Atrasadas" count={groups.atrasadas.length}>{groups.atrasadas.map((v) => <InvoiceRow key={v.invoice.id} view={v} today={data.today} onSelect={setSelectedId} />)}</Group>
            <Group title="Para pagar" count={groups.paraPagar.length}>{groups.paraPagar.map((v) => <InvoiceRow key={v.invoice.id} view={v} today={data.today} onSelect={setSelectedId} />)}</Group>
            <Group title="Em aberto" count={groups.abertas.length}>{groups.abertas.map((v) => <InvoiceRow key={v.invoice.id} view={v} today={data.today} onSelect={setSelectedId} />)}</Group>
            <Collapsible title="Próximas faturas" count={groups.futuras.length}>{groups.futuras.map((v) => <InvoiceRow key={v.invoice.id} view={v} today={data.today} onSelect={setSelectedId} />)}</Collapsible>
            <Collapsible title="Pagas" count={groups.pagas.length}>{groups.pagas.map((v) => <InvoiceRow key={v.invoice.id} view={v} today={data.today} onSelect={setSelectedId} />)}</Collapsible>
          </>
        )}
      </>
    );
  }

  return (
    <main className="min-h-dvh pb-28">
      <div className="mx-auto w-full max-w-[460px] px-4 pt-6">
        <header className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-[26px] font-semibold tracking-tight text-white">Faturas</h1>
          <Link href="/cartoes" className="text-[14px] text-white/45 transition hover:text-white/70">Cartões</Link>
        </header>
        {body}
      </div>
      <BottomNavigation />
      {selected && data && (
        <InvoiceDetailSheet key={selected.invoice.id} view={selected} accounts={data.accounts} defaultAccountId={cardOfSelected?.defaultPaymentAccountId} onClose={() => setSelectedId(null)} onDone={toast.show} />
      )}
      <Toast message={toast.message} />
    </main>
  );
}
