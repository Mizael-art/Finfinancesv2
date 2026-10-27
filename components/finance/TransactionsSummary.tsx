import { formatBRL } from "@/lib/format";

type Props = { income: number; expenses: number };

export default function TransactionsSummary({ income, expenses }: Props) {
  const balance = income - expenses;
  const items = [
    { label: "Receitas", value: income, tone: "text-ok" },
    { label: "Despesas", value: expenses, tone: "text-bad" },
    { label: "Saldo", value: balance, tone: balance >= 0 ? "text-white" : "text-bad" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {items.map((it) => (
        <div key={it.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-3">
          <p className="text-[12px] text-white/45">{it.label}</p>
          <p title={formatBRL(it.value)} className={`mt-1 truncate text-[14px] font-bold tabular-nums ${it.tone}`}>{formatBRL(it.value)}</p>
        </div>
      ))}
    </div>
  );
}
