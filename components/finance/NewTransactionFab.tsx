"use client";

/** Ação flutuante "+ Nova transação", mesma linguagem visual do botão do
 * Início (TransactionButton), mas em px fixo — para uso fora do card de
 * saldo, onde não há container query. */
export default function NewTransactionFab({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Nova transação"
      className="grid h-14 w-14 place-items-center rounded-full border border-white/20 bg-violet-500 hover:bg-violet-600 text-white transition duration-150 active:scale-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );
}
