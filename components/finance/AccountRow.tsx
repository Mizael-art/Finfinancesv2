import type { FullAccount } from "@/types/finance";
import { ACCOUNT_TYPE_LABEL } from "@/features/accounts/banks";
import { formatBRL } from "@/lib/format";

export default function AccountRow({ account, onClick }: { account: FullAccount; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${account.name}, ${ACCOUNT_TYPE_LABEL[account.type]}, saldo ${formatBRL(account.balance)}. Editar`}
      className="flex w-full items-center gap-3.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5 text-left transition active:scale-[0.98] hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
    >
      <span
        className="grid h-12 w-12 shrink-0 place-items-center rounded-lg text-[15px] font-black tracking-tighter text-white"
        style={{ background: `linear-gradient(180deg, ${account.tone[0]}, ${account.tone[1]})` }}
        aria-hidden
      >
        {account.glyph}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-white">{account.name}</span>
        <span className="block truncate text-[13px] text-white/45">{account.institution && account.institution !== ACCOUNT_TYPE_LABEL[account.type] ? `${ACCOUNT_TYPE_LABEL[account.type]} · ${account.institution}` : ACCOUNT_TYPE_LABEL[account.type]}</span>
      </span>
      <span className={`shrink-0 text-[15px] font-bold tabular-nums ${account.balance < 0 ? "text-bad-soft" : "text-white"}`}>{formatBRL(account.balance)}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-white/25">
        <path d="m9 6 6 6-6 6" />
      </svg>
    </button>
  );
}
