"use client";

import Link from "next/link";
import { useState } from "react";
import ErrorState from "@/components/ui/ErrorState";
import Toast from "@/components/ui/Toast";
import { useTheme } from "@/features/theme/useTheme";
import { THEMES, type ThemeDef, type ThemeId } from "@/features/theme/themes";
import { useToast } from "@/hooks/useToast";

/** Miniatura do tema: fundo, cartão e cor de destaque (cores próprias do tema, independentes do tema ativo). */
function Preview({ t }: { t: ThemeDef }) {
  return (
    <span aria-hidden className="relative block h-14 w-[72px] shrink-0 overflow-hidden rounded-lg border border-black/10" style={{ background: t.swatch.bg, ["--keep-light" as string]: "1" }}>
      <span className="absolute inset-x-2 top-2 h-1.5 w-8 rounded-full" style={{ background: t.swatch.text, opacity: 0.85 }} />
      <span className="absolute inset-x-2 top-5 h-6 rounded-md border" style={{ background: t.swatch.surface, borderColor: `${t.swatch.text}22` }}>
        <span className="absolute bottom-1.5 left-1.5 h-1.5 w-6 rounded-full" style={{ background: t.swatch.accent }} />
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full" style={{ background: t.swatch.accent }} />
      </span>
    </span>
  );
}

function Group({ title, items, active, onPick }: { title: string; items: ThemeDef[]; active?: ThemeId; onPick: (id: ThemeId) => void }) {
  return (
    <section aria-label={title} className="mb-6">
      <p className="mb-2.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-white/35">{title}</p>
      <div role="radiogroup" aria-label={title} className="flex flex-col gap-2">
        {items.map((t) => {
          const on = active === t.id;
          return (
            <button
              key={t.id} type="button" role="radio" aria-checked={on} onClick={() => onPick(t.id)}
              className={`flex w-full items-center gap-3.5 rounded-xl border px-3 py-3 text-left transition active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 ${on ? "border-violet-400 bg-white/[0.06]" : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05]"}`}
            >
              <Preview t={t} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-white">{t.name}</span>
                <span className="block text-[13px] leading-snug text-white/45">{t.description}</span>
              </span>
              <span aria-hidden className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${on ? "border-violet-400 bg-violet-500" : "border-white/20"}`}>
                {on && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7" /></svg>}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Escolha do tema: aplica na hora, em todas as telas, e fica salvo nas configurações. */
export default function ThemesView() {
  const { theme, setTheme, error, reload } = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const pick = async (id: ThemeId) => {
    if (busy || id === theme) return;
    setBusy(true);
    try { await setTheme(id); toast.show("Tema aplicado."); }
    catch { toast.show("Não foi possível salvar o tema agora."); reload(); }
    finally { setBusy(false); }
  };

  return (
    <main className="min-h-dvh pb-28">
      <div className="mx-auto w-full max-w-[460px] px-4 pt-6">
        <header className="mb-5 flex items-center gap-2">
          <Link href="/configuracoes" aria-label="Voltar para Configurações" className="-ml-2 grid h-10 w-10 place-items-center rounded-lg text-white/70 transition hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 6-6 6 6 6" /></svg>
          </Link>
          <h1 className="text-[26px] font-semibold tracking-tight text-white">Temas</h1>
        </header>
        {error && !theme ? <ErrorState onRetry={reload} /> : (
          <>
            <Group title="Escuros" items={THEMES.filter((t) => t.mode === "escuro")} active={theme} onPick={pick} />
            <Group title="Claros" items={THEMES.filter((t) => t.mode === "claro")} active={theme} onPick={pick} />
            <p className="px-1 text-[12px] leading-relaxed text-white/40">O tema muda o app inteiro. Receitas continuam verdes e despesas vermelhas em qualquer tema, e a carteira mantém o visual original.</p>
          </>
        )}
      </div>
      <Toast message={toast.message} />
    </main>
  );
}
