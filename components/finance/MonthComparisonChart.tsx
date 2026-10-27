import { formatBRL } from "@/lib/format";

type Point = { label: string; amount: number };

export default function MonthComparisonChart({ previous, current }: { previous: Point; current: Point }) {
  const max = Math.max(previous.amount, current.amount, 0.01);
  const diff = previous.amount - current.amount;
  const saved = diff > 0;
  const same = Math.abs(diff) < 0.005;

  const Bar = ({ point, cls }: { point: Point; cls: string }) => (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2">
      <div className="flex h-32 w-full items-end justify-center">
        <div
          className={`w-10 rounded-t-md ${cls}`}
          style={{ height: `${Math.max(2, (point.amount / max) * 100)}%` }}
        />
      </div>
      <p className="text-[12px] text-white/50">{point.label}</p>
      <p className="max-w-full truncate text-[13px] font-bold tabular-nums text-white">{formatBRL(point.amount)}</p>
    </div>
  );

  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
      <p className="mb-3 text-[13px] text-white/45">Gastos: {previous.label} vs {current.label}</p>
      <div className="flex items-end gap-6 px-2">
        <Bar point={previous} cls="bg-white/20" />
        <Bar point={current} cls="bg-violet-500" />
      </div>
      {same ? (
        <p className="mt-4 text-center text-[13px] font-semibold text-white/60">Gastos iguais nos dois períodos</p>
      ) : (
        <p className={`mt-4 truncate text-center text-[13px] font-semibold ${saved ? "text-ok" : "text-bad"}`}>
          {saved ? "Economia" : "Gasto a mais"}: {formatBRL(Math.abs(diff))}
        </p>
      )}
    </section>
  );
}
