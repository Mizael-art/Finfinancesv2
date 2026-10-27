"use client";

import { useState } from "react";
import AccountRow from "@/components/finance/AccountRow";
import AddAccountButton from "@/components/finance/AddAccountButton";
import TotalAccountsCard from "@/components/finance/TotalAccountsCard";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Toast from "@/components/ui/Toast";
import { useAccountsOverview } from "@/features/accounts/useAccountsOverview";
import { toFullAccount } from "@/features/accounts/viewModels";
import { useToast } from "@/hooks/useToast";
import { getServices } from "@/services";
import type { AccountWithBalance } from "@/services/accounts";
import AccountFormSheet from "./AccountFormSheet";

const walletIcon = <><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M3 10h18M8 10V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4" /></>;

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando contas" className="flex flex-col gap-3">
      <div className="h-36 animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] motion-reduce:animate-none" />
      {[0, 1, 2].map((i) => <div key={i} className="h-[76px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] motion-reduce:animate-none" />)}
    </div>
  );
}

/** Contas reais: patrimônio, lista com saldo, criar, editar, arquivar e restaurar. */
export default function AccountsView() {
  const { data, error, reload } = useAccountsOverview();
  const [form, setForm] = useState<{ key: number; account?: AccountWithBalance } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const toast = useToast();
  const open = (account?: AccountWithBalance) => setForm({ key: Date.now(), account });

  let body;
  if (!data && error) body = <ErrorState onRetry={reload} />;
  else if (!data) body = <Skeleton />;
  else if (data.accounts.length === 0 && data.archived.length === 0) {
    body = (
      <EmptyState
        icon={walletIcon}
        title="Adicione sua primeira conta."
        description="Cadastre suas contas e carteiras para acompanhar o saldo de cada uma."
        action={<AddAccountButton label="Nova conta" onClick={() => open()} />}
      />
    );
  } else {
    body = (
      <>
        {error && <div className="mb-4"><ErrorState title="Não foi possível atualizar" onRetry={reload} /></div>}
        <div className="mb-6"><TotalAccountsCard total={data.netWorthCents / 100} /></div>
        <p className="mb-2.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-white/35">Suas contas</p>
        {data.accounts.length === 0 ? (
          <p className="px-1 text-[14px] text-white/45">Todas as suas contas estão arquivadas. Restaure uma abaixo ou crie uma nova.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.accounts.map((a) => <AccountRow key={a.id} account={toFullAccount(a)} onClick={() => open(a)} />)}
          </div>
        )}

        {data.archived.length > 0 && (
          <section className="mt-6" aria-label="Contas arquivadas">
            <button type="button" aria-expanded={showArchived} onClick={() => setShowArchived((s) => !s)} className="px-1 text-[13px] font-semibold uppercase tracking-wide text-white/35 hover:text-white/55">
              Arquivadas ({data.archived.length})
            </button>
            {showArchived && (
              <ul className="mt-2.5 flex flex-col gap-2">
                {data.archived.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                    <span className="min-w-0 truncate text-[14px] text-white/70">{a.name}</span>
                    <button type="button" onClick={() => void getServices().accounts.restore(a.id).then(() => toast.show("Conta restaurada.")).catch(() => toast.show("Não foi possível restaurar."))} className="shrink-0 text-[13px] font-medium text-violet-300">Restaurar</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </>
    );
  }

  return (
    <main className="min-h-dvh pb-28">
      <div className="mx-auto w-full max-w-[460px] px-4 pt-6">
        <header className="mb-5 flex items-center justify-between">
          <h1 className="text-[26px] font-semibold tracking-tight text-white">Contas</h1>
          {data && (data.accounts.length > 0 || data.archived.length > 0) && <AddAccountButton label="Nova conta" onClick={() => open()} />}
        </header>
        {body}
      </div>
      {form && <AccountFormSheet key={form.key} account={form.account} onClose={() => setForm(null)} onDone={toast.show} />}
      <Toast message={toast.message} />
    </main>
  );
}
