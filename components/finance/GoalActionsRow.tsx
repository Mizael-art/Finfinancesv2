"use client";

const actions = [
  { label: "Adicionar", icon: <path d="M12 5v14M5 12h14" /> },
  { label: "Retirar", icon: <path d="M5 12h14" /> },
];

export default function GoalActionsRow({ onAdd, onWithdraw, canWithdraw = true }: { onAdd?: () => void; onWithdraw?: () => void; canWithdraw?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          onClick={a.label === "Adicionar" ? onAdd : onWithdraw}
          disabled={a.label === "Retirar" && !canWithdraw}
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] text-[13px] font-semibold text-white transition active:scale-95 hover:bg-white/[0.08] disabled:opacity-40 disabled:active:scale-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            {a.icon}
          </svg>
          {a.label}
        </button>
      ))}
    </div>
  );
}
