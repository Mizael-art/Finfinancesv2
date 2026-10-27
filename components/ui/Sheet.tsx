"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/** Folha inferior no celular, janela centralizada no desktop. Fecha com Esc ou toque fora. */
export default function Sheet({ open, onClose, title, children, dismissible = true }: { open: boolean; onClose: () => void; title: string; children: ReactNode; dismissible?: boolean }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && dismissible) onClose(); };
    document.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", onKey); };
  }, [open, onClose, dismissible]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-[var(--nav-h)] lg:items-center">
      <div aria-hidden onClick={() => dismissible && onClose()} className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-[calc(92dvh-var(--nav-h))] w-full max-w-[480px] flex-col rounded-t-xl border border-white/[0.08] bg-panel shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.8)] outline-none lg:rounded-xl"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <h2 id={titleId} className="text-[18px] font-semibold text-white">{title}</h2>
          <button type="button" aria-label="Fechar" disabled={!dismissible} onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] text-white/70 transition hover:bg-white/[0.1] disabled:opacity-40">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom,0px),20px)] pt-2">{children}</div>
      </div>
    </div>
  );
}
