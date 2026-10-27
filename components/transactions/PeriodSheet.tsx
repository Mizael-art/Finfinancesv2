"use client";

import Sheet from "@/components/ui/Sheet";
import { PERIODS, type PeriodId } from "@/features/transactions/periods";

/** Escolha do período da lista de transações. */
export default function PeriodSheet({ value, onSelect, onClose }: { value: PeriodId; onSelect: (id: PeriodId) => void; onClose: () => void }) {
  return (
    <Sheet open onClose={onClose} title="Período">
      <ul className="flex flex-col gap-2">
        {PERIODS.map((p) => {
          const active = p.id === value;
          return (
            <li key={p.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => { onSelect(p.id); onClose(); }}
                className={`flex h-12 w-full items-center justify-between rounded-lg border px-4 text-[15px] font-medium transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 ${
                  active ? "border-violet-400/40 bg-violet-500/20 text-white" : "border-white/[0.08] bg-white/[0.03] text-white/70 hover:bg-white/[0.06]"
                }`}
              >
                {p.label}
                {active && <span aria-hidden className="text-violet-300">✓</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
