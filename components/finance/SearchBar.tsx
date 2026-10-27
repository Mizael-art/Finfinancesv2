"use client";

type Props = { value?: string; onChange?: (value: string) => void };

export default function SearchBar({ value, onChange }: Props) {
  const controlled = value !== undefined;
  return (
    <div role="search" className="flex h-12 items-center gap-2.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-4">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-white/45" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.2-3.2" />
      </svg>
      <input
        type="search"
        aria-label="Pesquisar transações"
        placeholder="Pesquisar transações"
        {...(controlled ? { value, onChange: (e) => onChange?.(e.target.value) } : {})}
        className="w-full bg-transparent text-[15px] text-white placeholder:text-white/35 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {controlled && value !== "" && (
        <button type="button" aria-label="Limpar busca" onClick={() => onChange?.("")} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/50 hover:bg-white/[0.08] hover:text-white">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      )}
    </div>
  );
}
