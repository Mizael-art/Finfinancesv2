"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import AddAccountButton from "@/components/finance/AddAccountButton";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { SecondaryButton } from "@/components/ui/FormControls";
import Toast from "@/components/ui/Toast";
import InvoiceDetailSheet from "@/components/invoices/InvoiceDetailSheet";
import { usagePercent } from "@/features/cards/viewModels";
import { useCardsOverview } from "@/features/cards/useCardsOverview";
import { STATUS_LABEL, STATUS_TONE } from "@/features/invoices/viewModels";
import { useToast } from "@/hooks/useToast";
import { formatDayMonth, formatMonthLabel } from "@/lib/date";
import { formatCents } from "@/lib/money";
import { progressColor } from "@/lib/progress";
import { getServices } from "@/services";
import type { CardView } from "@/services/cards";
import type { Card } from "@/types/domain";
import CardFace from "./CardFace";
import CardFormSheet from "./CardFormSheet";

const cardIcon = <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 10h18M7 15h4" /></>;

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando cartões" className="flex flex-col gap-4">
      <div className="aspect-[16/10] w-[82%] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] motion-reduce:animate-none" />
      <div className="h-32 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] motion-reduce:animate-none" />
    </div>
  );
}

function Stat({ label, value, tone = "text-white" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-white/45">{label}</p>
      <p title={formatCents(value)} className={`mt-0.5 truncate text-[14px] font-bold tabular-nums ${tone}`}>{formatCents(value)}</p>
    </div>
  );
}

/** Cartões reais: carrossel, limite usado/disponível e a fatura atual de cada um. */
export default function CardsView() {
  const { data, error, reload } = useCardsOverview();
  const [index, setIndex] = useState(0);
  const [form, setForm] = useState<{ key: number; card?: Card } | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const cards = data?.cards ?? [];
  const current: CardView | undefined = cards[Math.min(index, Math.max(0, cards.length - 1))];
  const totals = cards.reduce((t, c) => ({ limit: t.limit + c.limitCents, used: t.used + c.usedCents, available: t.available + c.availableCents }), { limit: 0, used: 0, available: 0 });
  const view = data && current ? data.views.find((v) => v.invoice.id === current.nextInvoice.invoiceId) : undefined;
  const openView = data?.views.find((v) => v.invoice.id === invoiceId);
  const openCard = openView && data?.cards.find((c) => c.id === openView.cardId);

  const onScroll = () => {
    const el = scroller.current;
    if (!el || el.children.length === 0) return;
    const first = el.children[0] as HTMLElement;
    const step = first.offsetWidth + 16;
    setIndex(Math.max(0, Math.min(cards.length - 1, Math.round(el.scrollLeft / step))));
  };
  const goTo = (i: number) => {
    const el = scroller.current;
    if (!el) return;
    const step = (el.children[0] as HTMLElement).offsetWidth + 16;
    el.scrollTo({ left: step * i, behavior: "smooth" });
  };

  let body;
  if (!data && error) body = <ErrorState onRetry={reload} />;
  else if (!data) body = <Skeleton />;
  else if (cards.length === 0) {
    body = (
      <>
        <EmptyState
          icon={cardIcon}
          title="Adicione seu primeiro cartão."
          description="Cadastre o limite, o fechamento e o vencimento e acompanhe fatura e limite disponível."
          action={<AddAccountButton label="Novo cartão" onClick={() => setForm({ key: Date.now() })} />}
        />
        {data.archived.length > 0 && <p className="mt-4 text-center text-[13px] text-white/40">Você tem {data.archived.length} cartão(ões) arquivado(s).</p>}
      </>
    );
  } else if (current) {
    const { raw, bar } = usagePercent(current.usedCents, current.limitCents);
    const status = view?.status ?? "aberta";
    const tone = STATUS_TONE[status];
    body = (
      <>
        {error && <div className="mb-4"><ErrorState title="Não foi possível atualizar" onRetry={reload} /></div>}

        <section aria-label="Resumo dos cartões" className="mb-5 grid grid-cols-3 gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
          <Stat label="Limite total" value={totals.limit} />
          <Stat label="Disponível" value={totals.available} tone="text-ok" />
          <Stat label="Utilizado" value={totals.used} />
        </section>

        <div ref={scroller} onScroll={onScroll} role="group" aria-label="Seus cartões" className="-mx-4 mb-2 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {cards.map((c, i) => (
            <div key={c.id} aria-label={`Cartão ${c.name}`} className={`w-[82%] shrink-0 snap-start ${cards.length === 1 ? "w-full" : ""}`}>
              <button type="button" onClick={() => goTo(i)} aria-label={`Selecionar ${c.name}`} className="block w-full text-left">
                <CardFace card={c} />
              </button>
            </div>
          ))}
        </div>
        {cards.length > 1 && (
          <div className="mb-4 flex justify-center gap-1.5" aria-hidden>
            {cards.map((c, i) => <span key={c.id} className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white/80" : "w-1.5 bg-white/25"}`} />)}
          </div>
        )}

        <section aria-label={`Limite de ${current.name}`} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="truncate text-[15px] font-semibold text-white">{current.name}</p>
            <button type="button" onClick={() => setForm({ key: Date.now(), card: current })} className="shrink-0 text-[13px] font-medium text-violet-300 hover:text-violet-200">Editar</button>
          </div>
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="Limite" value={current.limitCents} />
            <Stat label="Disponível" value={current.availableCents} tone="text-ok" />
            <Stat label="Utilizado" value={current.usedCents} tone={current.overLimit ? "text-bad-soft" : "text-white"} />
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-label="Limite utilizado" aria-valuenow={Math.min(raw, 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full transition-all" style={{ width: `${bar}%`, background: progressColor(raw) }} />
          </div>
          <p className="mt-2 text-[12px] text-white/45">
            {current.overLimit ? "Limite ultrapassado · " : ""}Fecha dia {current.closingDay} · Vence dia {current.dueDay}
          </p>
        </section>

        <section aria-label="Fatura atual" className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] text-white/45">Fatura de {formatMonthLabel(current.nextInvoice.referenceKey)}</p>
              <p className="mt-0.5 truncate text-[22px] font-semibold tabular-nums tracking-tight text-white">{formatCents(current.nextInvoice.totalCents)}</p>
              <p className="mt-1 text-[12px] text-white/45">Fecha {formatDayMonth(current.nextInvoice.closingDate)} · vence {formatDayMonth(current.nextInvoice.dueDate)}</p>
            </div>
            <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ color: tone.text, background: tone.bg }}>{STATUS_LABEL[status]}</span>
          </div>
        </section>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <SecondaryButton onClick={() => (view ? setInvoiceId(view.invoice.id) : toast.show("Essa fatura ainda não tem compras."))}>Ver fatura</SecondaryButton>
          <Link href={`/faturas?cartao=${current.id}`} className="flex h-12 w-full items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-[15px] font-semibold text-white transition active:scale-[0.98] hover:bg-white/[0.08]">Todas as faturas</Link>
        </div>

        {data && data.archived.length > 0 && (
          <section className="mt-6" aria-label="Cartões arquivados">
            <button type="button" aria-expanded={showArchived} onClick={() => setShowArchived((s) => !s)} className="px-1 text-[13px] font-semibold uppercase tracking-wide text-white/35 hover:text-white/55">
              Arquivados ({data.archived.length})
            </button>
            {showArchived && (
              <ul className="mt-2.5 flex flex-col gap-2">
                {data.archived.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                    <span className="min-w-0 truncate text-[14px] text-white/70">{c.name}</span>
                    <button type="button" onClick={() => void getServices().cards.restore(c.id).then(() => toast.show("Cartão restaurado.")).catch(() => toast.show("Não foi possível restaurar."))} className="shrink-0 text-[13px] font-medium text-violet-300">Restaurar</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </>
    );
  }

  return (
    <main className="min-h-dvh pb-28">
      <div className="mx-auto w-full max-w-[460px] px-4 pt-6">
        <header className="mb-5 flex items-center justify-between">
          <h1 className="text-[26px] font-semibold tracking-tight text-white">Cartões</h1>
          {data && cards.length > 0 && <AddAccountButton label="Novo cartão" onClick={() => setForm({ key: Date.now() })} />}
        </header>
        {body}
      </div>
      {form && data && <CardFormSheet key={form.key} card={form.card} accounts={data.accounts} onClose={() => setForm(null)} onDone={toast.show} />}
      {openView && data && <InvoiceDetailSheet key={openView.invoice.id} view={openView} accounts={data.accounts} defaultAccountId={openCard?.defaultPaymentAccountId} onClose={() => setInvoiceId(null)} onDone={toast.show} />}
      <Toast message={toast.message} />
    </main>
  );
}
