import { formatBRL } from "@/lib/format";

type Props = { totalLimit: number; totalSpent: number; label?: string };

export default function BudgetsSummary({ totalLimit, totalSpent, label = "Orçado este mês" }: Props) {
  const remaining = totalLimit - totalSpent;
  return (
    <section className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
      <p className="text-[14px] text-white/50">{label}</p>
      <p className="mt-1 truncate text-[34px] font-semibold leading-none tracking-tight tabular-nums text-white">
        {formatBRL(totalLimit)}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="min-w-0 rounded-lg bg-white/[0.04] px-3.5 py-2.5">
          <p className="text-[11px] text-white/45">Gasto</p>
          <p className="mt-0.5 truncate text-[15px] font-bold tabular-nums text-white">{formatBRL(totalSpent)}</p>
        </div>
        <div className="min-w-0 rounded-lg bg-white/[0.04] px-3.5 py-2.5">
          <p className="text-[11px] text-white/45">{remaining >= 0 ? "Disponível" : "Acima do orçado"}</p>
          <p className={`mt-0.5 truncate text-[15px] font-bold tabular-nums ${remaining >= 0 ? "text-ok" : "text-bad"}`}>
            {remaining < 0 ? "−" : ""}{formatBRL(Math.abs(remaining))}
          </p>
        </div>
      </div>
    </section>
  );
}
