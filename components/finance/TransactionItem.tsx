import type { Transaction } from "@/types/finance";
import { formatBRL } from "@/lib/format";
import { formatTime } from "@/lib/date";
import { toneFor } from "@/lib/category";

function CategoryIcon({ category, customColor }: { category: string; customColor?: string }) {
  const color = customColor ?? toneFor(category);
  return (
    <span
      className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[15px] font-bold"
      style={{ background: `${color}22`, color }}
      aria-hidden
    >
      {category.slice(0, 1)}
    </span>
  );
}

export default function TransactionItem({ tx, onSelect }: { tx: Transaction; onSelect?: (id: string) => void }) {
  const signed = tx.type === "receita" ? tx.amount : tx.type === "despesa" ? -tx.amount : tx.amount;
  const color = tx.type === "receita" ? "text-ok" : tx.type === "despesa" ? "text-white" : "text-white/70";
  const prefix = tx.type === "receita" ? "+ " : tx.type === "despesa" ? "- " : "";

  return (
    <button
      type="button"
      onClick={() => onSelect?.(tx.id)}
      className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3 text-left transition active:scale-[0.98] hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
    >
      <CategoryIcon category={tx.category} customColor={tx.categoryColor} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-white">{tx.description}</span>
        <span className={`block ${tx.note ? "line-clamp-2" : "truncate"} text-[13px] text-white/45`}>
          {tx.category} · {tx.account}
          {tx.note ? ` · ${tx.note}` : tx.date.includes("T") ? ` · ${formatTime(tx.date)}` : ""}
        </span>
      </span>
      <span className={`shrink-0 text-[15px] font-semibold tabular-nums ${color}`}>
        {prefix}
        {formatBRL(Math.abs(signed))}
      </span>
    </button>
  );
}
