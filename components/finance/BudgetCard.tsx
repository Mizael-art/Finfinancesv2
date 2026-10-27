import type { Budget } from "@/types/finance";
import { formatBRL } from "@/lib/format";
import { progressColor } from "@/lib/progress";
import { toneFor } from "@/lib/category";

export default function BudgetCard({ budget, onClick }: { budget: Budget; onClick?: () => void }) {
  const rawPct = budget.limit > 0 ? Math.round((budget.spent / budget.limit) * 100) : 0;
  const pct = Math.min(100, rawPct);
  const color = progressColor(rawPct);
  const tone = budget.color ?? toneFor(budget.category);
  const over = rawPct >= 100;

  const body = (
    <>
      <div className="mb-3 flex items-center gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[13px] font-bold"
          style={{ background: `${tone}22`, color: tone }}
          aria-hidden
        >
          {budget.category.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-white">{budget.category}</p>
          <p className="truncate text-[13px] tabular-nums text-white/45">
            {formatBRL(budget.spent)} de {formatBRL(budget.limit)}
          </p>
        </div>
        <span className="shrink-0 text-[14px] font-bold tabular-nums" style={{ color }}>
          {rawPct}%
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>

      {over && (
        <p className="mt-2 text-[12px] font-medium" style={{ color }}>
          Limite ultrapassado em {formatBRL(budget.spent - budget.limit)}
        </p>
      )}
      {!over && rawPct >= 80 && (
        <p className="mt-2 text-[12px] font-medium" style={{ color }}>
          Perto do limite
        </p>
      )}
    </>
  );
  const box = "rounded-xl border border-white/[0.06] bg-white/[0.03] p-4";
  if (!onClick) return <article className={box}>{body}</article>;
  return (
    <button type="button" onClick={onClick} aria-label={`${budget.category}, ${formatBRL(budget.spent)} de ${formatBRL(budget.limit)}, ${rawPct}%`}
      className={`${box} block w-full text-left transition active:scale-[0.99] hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400`}>
      {body}
    </button>
  );
}
