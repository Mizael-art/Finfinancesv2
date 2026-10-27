"use client";

import { useRouter } from "next/navigation";
import Sheet from "@/components/ui/Sheet";

const row = "flex w-full items-center gap-3.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5 text-left transition active:scale-[0.98] hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400";
const icon = "grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-white/85";

/** Menu do botão "+": lançar uma transação ou cadastrar uma despesa fixa (que se repete todo mês). */
export default function AddMenuSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const go = (href: string) => { onClose(); router.push(href); };
  return (
    <Sheet open onClose={onClose} title="Adicionar">
      <div className="flex flex-col gap-2.5">
        <button type="button" onClick={() => go("/transacoes/nova")} className={row}>
          <span className={icon}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-white">Nova transação</span>
            <span className="block text-[13px] text-white/45">Receita, despesa ou transferência</span>
          </span>
        </button>
        <button type="button" onClick={() => go("/fixas?nova=1")} className={row}>
          <span className={icon}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-white">Nova despesa fixa</span>
            <span className="block text-[13px] text-white/45">Aluguel, internet, assinaturas — lançada todo mês</span>
          </span>
        </button>
      </div>
    </Sheet>
  );
}
