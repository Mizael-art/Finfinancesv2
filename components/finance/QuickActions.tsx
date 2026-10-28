import Link from "next/link";

const base = "flex rounded-xl border px-3.5 py-3.5 transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400";

/** Atalhos da tela inicial: relatórios (para onde o dinheiro foi) e despesas fixas. */
export default function QuickActions() {
  return (
    <nav aria-label="Atalhos" className="mx-auto mt-5 grid w-full max-w-[460px] grid-cols-2 gap-3 px-4">
      <Link href="/relatorios" className={`${base} flex-col items-start gap-2.5 border-violet-400/35 bg-violet-500/[0.12] hover:bg-violet-500/[0.18]`}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-violet-500/25 text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 20V10M12 20V4M19 20v-7" /></svg>
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold leading-tight text-white">Relatórios</span>
          <span className="block text-[12px] text-white/50">Seu dashboard</span>
        </span>
      </Link>
      <Link href="/planejamento" className={`${base} flex-col items-start gap-2.5 border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]`}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-white/85">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></svg>
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold leading-tight text-white">Planejamento</span>
          <span className="block text-[12px] text-white/45">Próximos meses</span>
        </span>
      </Link>
      <Link href="/fixas" className={`${base} col-span-2 items-center gap-3 border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]`}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-white/85">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></svg>
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold leading-tight text-white">Despesas fixas</span>
          <span className="block text-[12px] text-white/45">Contas do mês</span>
        </span>
      </Link>
    </nav>
  );
}
