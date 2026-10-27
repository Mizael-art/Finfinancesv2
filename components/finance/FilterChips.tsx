"use client";

const defaultFilters = ["Todas", "Receitas", "Despesas", "Transferências"];

type Props = {
  items?: string[];
  /** Índice do chip ativo. Sem `active`, o primeiro fica marcado (comportamento original). */
  active?: number;
  onSelect?: (index: number) => void;
};

export default function FilterChips({ items = defaultFilters, active = 0, onSelect }: Props) {
  return (
    <div role="group" aria-label="Filtrar" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((f, i) => (
        <button
          key={f}
          type="button"
          aria-pressed={i === active}
          onClick={() => onSelect?.(i)}
          className={`h-9 shrink-0 rounded-full border px-4 text-[13px] font-medium transition active:scale-95 ${
            i === active
              ? "border-violet-400/40 bg-violet-500/20 text-white"
              : "border-white/[0.08] bg-white/[0.03] text-white/60 hover:bg-white/[0.06]"
          }`}
        >
          {f}
        </button>
      ))}
    </div>
  );
}
