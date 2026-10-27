import Link from "next/link";
import type { BankAccountCardData } from "@/types/finance";
import BankAccountCard from "./BankAccountCard";

export default function AccountsSection({ accounts }: { accounts: BankAccountCardData[] }) {
  return (
    <section aria-label="Contas Bancárias" className="mx-auto mt-8 w-full max-w-[460px] pl-4">
      <div className="mb-4 flex items-center justify-between pr-4">
        <h2 className="text-[20px] font-semibold tracking-tight text-white">Contas Bancárias</h2>
        <Link href="/contas" className="flex items-center gap-1 text-[14px] text-white/45 transition hover:text-white/70 active:opacity-60">
          Ver Todos
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
        </Link>
      </div>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pr-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {accounts.map((a) => <BankAccountCard key={a.id} account={a} />)}
      </div>
    </section>
  );
}
