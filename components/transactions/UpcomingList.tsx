"use client";

import Link from "next/link";
import { useUpcoming } from "@/features/upcoming/useUpcoming";
import { monthKey, monthName } from "@/lib/date";
import { formatCents } from "@/lib/money";

const MAX = 12;

/** Contas fixas e faturas de cartão que ainda vão vencer (próximos 3 meses). Toque abre onde pagar ou marcar como paga. */
export default function UpcomingList({ today }: { today: string }) {
  const { data } = useUpcoming(today);
  if (!data || data.length === 0) return null;
  const total = data.reduce((s, i) => s + i.cents, 0);
  const shown = data.slice(0, MAX);
  return (
    <section aria-label="A vencer" className="mb-5">
      <p className="mb-2 flex justify-between px-1 text-[13px] font-semibold uppercase tracking-wide text-white/35">
        <span>A vencer · próximos 3 meses</span>
        <span className="tabular-nums">{formatCents(total)}</span>
      </p>
      <ul className="flex flex-col gap-2">
        {shown.map((i) => (
          <li key={i.id}>
            <Link
              href={i.href}
              className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 transition active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 ${i.status === "atrasada" ? "border-bad/35 bg-bad/[0.07] hover:bg-bad/10" : i.status === "hoje" ? "border-amber-400/30 bg-amber-400/[0.07] hover:bg-amber-400/10" : "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]"}`}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-center leading-none">
                <span>
                  <span className="block text-[16px] font-semibold tabular-nums text-white">{Number(i.dueDate.slice(8, 10))}</span>
                  <span className="block text-[10px] font-medium uppercase text-white/45">{monthName(monthKey(i.dueDate)).slice(0, 3)}</span>
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-white">{i.title}</span>
                <span className={`block truncate text-[12.5px] ${i.status === "atrasada" ? "font-medium text-bad-soft" : i.status === "hoje" ? "font-medium text-amber-300" : "text-white/45"}`}>
                  {i.status === "atrasada" ? "Atrasada" : i.status === "hoje" ? "Vence hoje" : i.kind === "fatura" ? i.detail ?? "Fatura" : "Conta fixa"}
                  {i.status !== "proxima" && i.kind === "fatura" && i.detail ? ` · ${i.detail}` : ""}
                </span>
              </span>
              <span className="shrink-0 text-[15px] font-semibold tabular-nums text-white">{formatCents(i.cents)}</span>
            </Link>
          </li>
        ))}
      </ul>
      {data.length > MAX && <p className="mt-2 px-1 text-[12px] text-white/40">e mais {data.length - MAX} {data.length - MAX === 1 ? "item" : "itens"}.</p>}
    </section>
  );
}
