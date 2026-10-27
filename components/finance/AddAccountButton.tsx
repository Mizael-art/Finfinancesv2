"use client";

export default function AddAccountButton({ label = "Nova conta", onClick }: { label?: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-violet-500 hover:bg-violet-600 pl-3 pr-3.5 text-[13px] font-semibold text-white transition active:scale-95 hover:brightness-110"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
      {label}
    </button>
  );
}
