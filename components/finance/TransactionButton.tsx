"use client";

export default function TransactionButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ fontSize: "3.5cqw" }}
      className="flex h-full w-full items-center justify-center gap-[1.6cqw] rounded-full border border-white/25 bg-gradient-to-b from-white/15 to-white/[0.04] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition duration-150 hover:bg-white/20 active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" style={{ width: "1.25em", height: "1.25em" }}>
        <path d="M12 5v14M5 12h14" />
      </svg>
      Transação
    </button>
  );
}
