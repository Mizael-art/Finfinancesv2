import Link from "next/link";
import { Suspense } from "react";
import NewTransactionForm from "@/components/finance/NewTransactionForm";

export default async function EditarTransacaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="min-h-dvh pb-28">
      <div className="mx-auto w-full max-w-[460px] px-4 pt-6">
        <header className="mb-5 flex items-center gap-3">
          <Link
            href="/transacoes"
            aria-label="Voltar para Transações"
            className="grid h-10 w-10 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] text-white transition active:scale-95 hover:bg-white/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m15 6-6 6 6 6" />
            </svg>
          </Link>
          <h1 className="text-[26px] font-semibold tracking-tight text-white">Editar transação</h1>
        </header>
        <Suspense fallback={null}>
          <NewTransactionForm transactionId={id} />
        </Suspense>
      </div>
    </main>
  );
}
