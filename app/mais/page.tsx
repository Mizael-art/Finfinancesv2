import Link from "next/link";
import { MORE_LINKS } from "@/features/more/links";

export const metadata = { title: "Mais · FinFinance" };

export default function MaisPage() {
  return (
    <main className="min-h-dvh pb-28">
      <div className="mx-auto w-full max-w-[460px] px-4 pt-6">
        <header className="mb-5">
          <h1 className="text-[26px] font-semibold tracking-tight text-white">Mais</h1>
        </header>
        <nav aria-label="Mais opções" className="flex flex-col gap-2">
          {MORE_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-3.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5 transition active:scale-[0.98] hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-white/80">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {l.icon.map((d) => <path key={d} d={d} />)}
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-white">{l.label}</span>
                <span className="block truncate text-[13px] text-white/45">{l.description}</span>
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-white/25" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
