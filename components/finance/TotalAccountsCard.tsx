import Link from "next/link";
import { splitBRL } from "@/lib/format";

export default function TotalAccountsCard({ total }: { total: number }) {
  const { symbol, value } = splitBRL(total);
  return (
    <section
      aria-label="Saldo em contas"
      className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5"
    >
      <p className="text-[14px] text-white/50">Saldo em contas</p>
      <p className="mt-1 flex items-baseline gap-1.5 font-semibold tracking-tight text-white">
        <span className="text-[18px] text-white/50">{symbol}</span>
        <span className="text-[36px] leading-none tabular-nums">{value}</span>
      </p>

      <Link
        href="/transacoes/nova?tipo=transferencia"
        className="mt-4 inline-flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 text-[13px] font-semibold text-white transition active:scale-95 hover:bg-white/[0.08]"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3 21 7l-4 4M21 7H9M7 21l-4-4 4-4M3 17h12" />
        </svg>
        Transferir dinheiro
      </Link>
    </section>
  );
}
