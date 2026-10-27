import type { Transaction } from "@/types/finance";
import { groupByDay } from "@/lib/date";
import TransactionItem from "./TransactionItem";

export default function TransactionsList({ items, onSelect }: { items: Transaction[]; onSelect?: (id: string) => void }) {
  const groups = groupByDay(items);
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g, i) => (
        <div key={`${g.label}-${i}`}>
          <p className="mb-2.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-white/35">{g.label}</p>
          <div className="flex flex-col gap-2">
            {g.items.map((tx) => (
              <TransactionItem key={tx.id} tx={tx} onSelect={onSelect} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
