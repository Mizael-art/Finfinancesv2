"use client";

import { useRouter } from "next/navigation";
import { H, W } from "@/lib/wallet";
import type { WalletCard } from "@/types/finance";
import AccountStack from "./AccountStack";
import BalanceCard from "./BalanceCard";
import PeriodSelector from "./PeriodSelector";
import WalletBack from "./WalletBack";

type Props = {
  wallet: WalletCard[];
  totalReais: number;
  cardUsedReais: number;
  cashReais: number;
  hidden: boolean;
  onToggleHidden: () => void;
  periodLabel?: string;
  /** "Bom dia, João" (só aparece depois do onboarding) */
  greeting?: string;
};

/** Carteira do Início: painel de saldo + até 3 contas empilhadas (dados reais vêm por props). */
export default function FinanceHero({ wallet, totalReais, cardUsedReais, cashReais, hidden, onToggleHidden, periodLabel = "Esse Mês", greeting }: Props) {
  const router = useRouter();
  return (
    <div className="mx-auto w-full max-w-[460px] px-4 pt-6">
      <header className="mb-8 flex items-center justify-between">
        <div className="min-w-0">
          {greeting && <p className="truncate text-[13px] text-white/50">{greeting}</p>}
          <h1 className="text-[26px] font-semibold tracking-tight text-white">Financeiro</h1>
        </div>
        <PeriodSelector label={periodLabel} onClick={() => router.push("/transacoes")} />
      </header>

      {/* Camadas: fundo da carteira -> cartões -> painel frontal com conteúdo */}
      <div
        className="keep-light relative w-full"
        style={{ aspectRatio: `${W} / ${H}`, containerType: "inline-size", filter: "drop-shadow(0 28px 30px rgba(120,0,30,0.25))" }}
      >
        <WalletBack />
        <AccountStack accounts={wallet} hidden={hidden} />
        <BalanceCard
          total={totalReais}
          chipCard={cardUsedReais}
          chipCash={cashReais}
          hidden={hidden}
          onToggleHidden={onToggleHidden}
          onNewTransaction={() => router.push("/transacoes/nova")}
          onCalendar={() => router.push("/transacoes")}
        />
      </div>
    </div>
  );
}
