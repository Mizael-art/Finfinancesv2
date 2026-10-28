"use client";

import { useUpcoming } from "@/features/upcoming/useUpcoming";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { addDays } from "@/lib/date";
import { formatCents } from "@/lib/money";
import { getServices } from "@/services";

/**
 * Lançamentos com data futura (agendados) não aparecem no mês atual. Este aviso mostra que eles existem
 * e leva direto à lista deles, onde dá para abrir, editar ou apagar.
 */
export default function FutureBanner({ today, onOpen }: { today: string; onOpen: () => void }) {
  const { data } = useLiveQuery(async () => {
    const txs = await getServices().transactions.list({ from: addDays(today, 1) });
    return {
      count: txs.length,
      expenseCents: txs.filter((t) => t.type === "despesa").reduce((s, t) => s + t.amountCents, 0),
      incomeCents: txs.filter((t) => t.type === "receita").reduce((s, t) => s + t.amountCents, 0),
    };
  }, [today]);
  const { data: upcoming } = useUpcoming(today);
  const dueCount = upcoming?.length ?? 0;
  if (!data || (data.count === 0 && dueCount === 0)) return null;
  const title = [
    data.count > 0 ? `${data.count} ${data.count === 1 ? "lançamento futuro" : "lançamentos futuros"}` : "",
    dueCount > 0 ? `${dueCount} ${dueCount === 1 ? "conta ou fatura" : "contas e faturas"} a vencer` : "",
  ].filter(Boolean).join(" · ");
  const parts = [data.expenseCents > 0 ? `Despesas ${formatCents(data.expenseCents)}` : "", data.incomeCents > 0 ? `Receitas ${formatCents(data.incomeCents)}` : "", dueCount > 0 && data.count === 0 ? `A vencer ${formatCents(upcoming!.reduce((s, i) => s + i.cents, 0))}` : ""].filter(Boolean).join(" · ");
  return (
    <button type="button" onClick={onOpen} className="mb-4 flex w-full items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.08] px-3.5 py-3 text-left transition active:scale-[0.99] hover:bg-amber-400/[0.12] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400">
      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold leading-snug text-white">{title}</span>
        <span className="block text-[12.5px] leading-snug text-white/55">{parts}. Toque para ver.</span>
      </span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-white/35"><path d="m9 6 6 6-6 6" /></svg>
    </button>
  );
}
