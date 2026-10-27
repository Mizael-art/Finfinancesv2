import { formatBRL } from "@/lib/format";

export default function GoalsSummary({ totalSaved, count }: { totalSaved: number; count: number }) {
  return (
    <section className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
      <p className="text-[14px] text-white/50">Guardado em metas</p>
      <p className="mt-1 truncate text-[34px] font-semibold leading-none tracking-tight tabular-nums text-white">
        {formatBRL(totalSaved)}
      </p>
      <p className="mt-3 text-[13px] text-white/45">
        {count} {count === 1 ? "meta ativa" : "metas ativas"}
      </p>
    </section>
  );
}
