import { STATUS_LABEL, STATUS_TONE, dueText, referenceLabel } from "@/features/invoices/viewModels";
import { formatCents } from "@/lib/money";
import type { InvoiceView } from "@/services/invoices/compute";

/** Linha de fatura: cartão, mês, vencimento, status e total. */
export default function InvoiceRow({ view, today, onSelect }: { view: InvoiceView; today: string; onSelect: (id: string) => void }) {
  const tone = STATUS_TONE[view.status];
  return (
    <button
      type="button"
      onClick={() => onSelect(view.invoice.id)}
      className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5 text-left transition active:scale-[0.99] hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-white">{view.cardName}</p>
        <p className="truncate text-[12px] text-white/70">{referenceLabel(view)}</p>
        <p className="truncate text-[12px] text-white/45">{dueText(view, today)}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <p className="max-w-[150px] truncate text-[15px] font-bold tabular-nums text-white">{formatCents(view.totalCents)}</p>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: tone.text, background: tone.bg }}>{STATUS_LABEL[view.status]}</span>
      </div>
    </button>
  );
}
