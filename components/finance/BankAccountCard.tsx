import Link from "next/link";
import type { BankAccountCardData } from "@/types/finance";
import { formatBRL } from "@/lib/format";
import Sparkline from "./Sparkline";

const tile: Record<Exclude<BankAccountCardData["wordmark"], "generic">, { bg: string; label: string; cls: string }> = {
  c6: { bg: "#151516", label: "C6", cls: "text-[19px] font-black tracking-tighter text-white" },
  nu: { bg: "linear-gradient(180deg,#8B2CF0,#6A16C9)", label: "nu", cls: "text-[22px] font-black tracking-tighter text-white" },
  inter: { bg: "linear-gradient(180deg,#F0682A,#D9501B)", label: "inter", cls: "text-[13px] font-black italic tracking-tight text-white" },
};

export default function BankAccountCard({ account, href = "/contas" }: { account: BankAccountCardData; href?: string }) {
  const t = account.wordmark === "generic"
    ? { bg: `linear-gradient(180deg, ${account.tone[0]}, ${account.tone[1]})`, label: account.label, cls: "text-[17px] font-black tracking-tighter text-white" }
    : tile[account.wordmark];
  const negative = account.balance < 0;
  return (
    <Link href={href} aria-label={`${account.name}, saldo ${formatBRL(account.balance)}. Abrir contas`} className="relative block focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 w-[62vw] max-w-[285px] shrink-0 snap-start rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5 transition active:scale-[0.98]">
      <div className="flex items-center gap-3">
        <div className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-lg border border-white/10" style={{ background: t.bg }}>
          <span className={t.cls}>{t.label}</span>
        </div>
        <div className="h-9 flex-1">
          <Sparkline data={account.trend} />
        </div>
      </div>
      <p className="mt-2.5 flex items-center justify-end gap-1.5 text-[13px] text-white/60">
        <svg width="8" height="8" viewBox="0 0 10 10" fill={negative ? "rgb(var(--bad))" : "rgb(var(--ok))"} aria-hidden><path d={negative ? "M5 9 1 2h8z" : "M5 1 9 8H1z"} /></svg>
        Saldo:
        <span className={`text-[15px] font-bold tabular-nums ${negative ? "text-bad" : "text-ok"}`}>{formatBRL(account.balance)}</span>
      </p>
    </Link>
  );
}
