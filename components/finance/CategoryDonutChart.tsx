import { toneFor } from "@/lib/category";
import { formatBRL } from "@/lib/format";

type Slice = { category: string; pct: number; /** cor da categoria; sem ela, usa a cor por nome */ color?: string; /** valor em reais, mostrado na legenda quando informado */ amount?: number };

const R = 60;
const CIRC = 2 * Math.PI * R;

export default function CategoryDonutChart({ data, total }: { data: Slice[]; total: number }) {
  let offset = 0;
  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
      <div className="flex items-center gap-5">
        <svg viewBox="0 0 140 140" className="h-[130px] w-[130px] shrink-0 -rotate-90" role="img" aria-label="Gráfico de gastos por categoria">
          <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="16" />
          {data.map((d) => {
            const len = (d.pct / 100) * CIRC;
            const el = (
              <circle
                key={d.category}
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={d.color ?? toneFor(d.category)}
                strokeWidth="16"
                strokeDasharray={`${len} ${CIRC - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += len;
            return el;
          })}
        </svg>

        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-white/45">Total no período</p>
          <p className="truncate text-[20px] font-bold tabular-nums text-white" title={formatBRL(total)}>{formatBRL(total)}</p>
        </div>
      </div>

      <ul className="mt-4 flex flex-col gap-2.5">
        {data.map((d) => (
          <li key={d.category} className="flex items-center gap-2.5 text-[13px]">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color ?? toneFor(d.category) }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-white/75">{d.category}</span>
            {d.amount !== undefined && <span className="shrink-0 tabular-nums text-white/50">{formatBRL(d.amount)}</span>}
            <span className="w-10 shrink-0 text-right font-semibold tabular-nums text-white">{d.pct}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
