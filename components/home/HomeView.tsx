"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AccountsSection from "@/components/finance/AccountsSection";
import AddAccountButton from "@/components/finance/AddAccountButton";
import FinanceHero from "@/components/finance/FinanceHero";
import RecentTransactionsSection from "@/components/finance/RecentTransactionsSection";
import BottomNavigation from "@/components/ui/BottomNavigation";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Link from "next/link";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { getServices } from "@/services";
import { displayName, greetingFor } from "@/services/onboarding/compute";
import { useAccountsOverview } from "@/features/accounts/useAccountsOverview";
import { toBankCard, toWalletCards } from "@/features/accounts/viewModels";

const walletIcon = <><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M3 10h18M8 10V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4" /></>;

/** Início com dados reais: carteira, contas e transações recentes. */
export default function HomeView() {
  const { data, error, reload } = useAccountsOverview();
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  const { data: profile } = useLiveQuery(async () => {
    const s = getServices();
    const [user, settings] = await Promise.all([s.users.getCurrent(), s.settings.get()]);
    return { name: user ? displayName({ name: user.name, nickname: user.nickname ?? "" }) : "", completed: settings.onboardingCompleted };
  }, []);
  const greeting = profile?.name ? `${greetingFor(new Date().getHours())}, ${profile.name}` : undefined;

  return (
    <main className="min-h-dvh pb-28">
      {profile && !profile.completed && (
        <div className="mx-auto w-full max-w-[460px] px-4 pt-4">
          <Link href="/onboarding" className="flex items-center justify-between gap-3 rounded-xl border border-violet-400/40 bg-violet-500/10 px-4 py-3 text-[14px] text-white transition hover:bg-violet-500/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400">
            <span><span className="block font-semibold">Personalize seu FinFinance</span><span className="block text-[13px] text-white/55">Leva um minuto e nada do que você já tem é apagado.</span></span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 6 6 6-6 6" /></svg>
          </Link>
        </div>
      )}
      {!data && error ? (
        <div className="mx-auto mt-6 w-full max-w-[460px] px-4"><ErrorState onRetry={reload} /></div>
      ) : !data ? (
        <div aria-busy="true" aria-label="Carregando" className="mx-auto mt-16 w-full max-w-[460px] px-4">
          <div className="aspect-[1080/830] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] motion-reduce:animate-none" />
        </div>
      ) : data.accounts.length === 0 ? (
        <div className="mx-auto mt-6 w-full max-w-[460px] px-4">
          {greeting && <p className="text-[13px] text-white/50">{greeting}</p>}
          <h1 className="mb-6 text-[26px] font-semibold tracking-tight text-white">Financeiro</h1>
          <EmptyState
            icon={walletIcon}
            title="Comece adicionando uma conta."
            description="Com uma conta cadastrada você já pode lançar receitas e despesas e ver o saldo aqui."
            action={<AddAccountButton label="Nova conta" onClick={() => router.push("/contas")} />}
          />
        </div>
      ) : (
        <>
          <FinanceHero
            wallet={toWalletCards(data.accounts)}
            totalReais={data.netWorthCents / 100}
            cardUsedReais={data.cardUsedCents / 100}
            cashReais={data.cashCents / 100}
            hidden={hidden}
            greeting={greeting}
            onToggleHidden={() => setHidden((h) => !h)}
          />
          <AccountsSection accounts={data.accounts.slice(0, 6).map(toBankCard)} />
        </>
      )}
      <RecentTransactionsSection />
      <BottomNavigation />
    </main>
  );
}
