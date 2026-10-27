"use client";

const actions = [
  { label: "Ver fatura", icon: <path d="M6 3h9l3 3v15H6zM15 3v4h4M9 12h6M9 16h6" /> },
  { label: "Compras", icon: <><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></> },
];

export default function CardActionsRow() {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-[13px] font-semibold text-white transition active:scale-95 hover:bg-white/[0.08]"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {a.icon}
          </svg>
          {a.label}
        </button>
      ))}
    </div>
  );
}
