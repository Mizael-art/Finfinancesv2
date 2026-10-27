"use client";

export default function PeriodSelector({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup={onClick ? "dialog" : undefined}
      className="inline-flex h-9 items-center gap-2 rounded-full bg-violet-500 px-3.5 text-[14px] font-bold text-white transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
        <path d="M8 3v4M16 3v4M3.5 10h17" />
      </svg>
      {label}
    </button>
  );
}
