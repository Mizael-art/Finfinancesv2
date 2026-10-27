import type { Transaction } from "@/types/finance";
import { toneFor } from "@/lib/category";
import { formatBRL } from "@/lib/format";

export default function TopExpensesList({ items }: { items: Transaction[] }) {
  const top = [...items]
    .filter((t) => t.type === "despesa")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 4);

  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
      <p className="mb-3 text-[13px] text-white/45">Maiores despesas</p>
      <div className="flex flex-col gap-3">
        {top.map((t) => (
          <div key={t.id} className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.categoryColor ?? toneFor(t.category) }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[14px] text-white/80">{t.description}</span>
            <span className="shrink-0 text-[14px] font-bold tabular-nums text-white">{formatBRL(t.amount)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
