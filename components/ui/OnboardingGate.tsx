"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { getServices } from "@/services";

/**
 * Porteiro do primeiro acesso: quem ainda não concluiu a configuração inicial e não tem dados vai para /onboarding.
 * Quem já usa o app (tem contas, cartões ou transações) segue normalmente, sem perder nada; a Início oferece completar o perfil.
 */
export default function OnboardingGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data, error } = useLiveQuery(async () => {
    const s = getServices();
    const [settings, accounts, cards, txs] = await Promise.all([s.settings.get(), s.accounts.list({ includeArchived: true }), s.cards.list({ includeArchived: true }), s.transactions.count()]);
    return { completed: settings.onboardingCompleted, hasData: accounts.length + cards.length + txs > 0 };
  }, []);

  const inOnboarding = pathname?.startsWith("/onboarding") ?? false;
  const mustOnboard = !!data && !data.completed && !data.hasData && !inOnboarding;

  useEffect(() => { if (mustOnboard) router.replace("/onboarding"); }, [mustOnboard, router]);

  if (inOnboarding || error) return <>{children}</>; // sem leitura possível, não trava o app (a própria tela mostra o erro)
  if (!data || mustOnboard) return <div aria-busy="true" aria-label="Carregando" className="min-h-dvh" />;
  return <>{children}</>;
}
