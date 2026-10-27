import type { CreditCard } from "@/types/finance";
import { formatBRL } from "@/lib/format";
import { progressColor } from "@/lib/progress";

export default function CardLimitSummary({ card }: { card: CreditCard }) {
  const available = card.limitTotal - card.limitUsed;
  const rawPct = Math.round((card.limitUsed / card.limitTotal) * 100);
  const pct = Math.min(100, rawPct);
  const barColor = progressColor(rawPct);

  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[11px] text-white/45">Limite</p>
          <p className="mt-0.5 truncate text-[14px] font-bold tabular-nums text-white">{formatBRL(card.limitTotal)}</p>
        </div>
        <div>
          <p className="text-[11px] text-white/45">Disponível</p>
          <p className="mt-0.5 truncate text-[14px] font-bold tabular-nums text-ok">{formatBRL(available)}</p>
        </div>
        <div>
          <p className="text-[11px] text-white/45">Utilizado</p>
          <p className="mt-0.5 truncate text-[14px] font-bold tabular-nums text-white">{formatBRL(card.limitUsed)}</p>
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <p className="mt-2 text-[12px] text-white/45">
        Fecha dia {card.closingDay} · Vence dia {card.dueDay}
      </p>
    </section>
  );
}
