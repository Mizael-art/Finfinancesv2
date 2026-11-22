"use client";

import { useState } from "react";
import AddAccountButton from "@/components/finance/AddAccountButton";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Toast from "@/components/ui/Toast";
import { useLiveQuery } from "@/hooks/useLiveQuery";
import { useToast } from "@/hooks/useToast";
import { formatCents } from "@/lib/money";
import { getServices } from "@/services";
import IncomeFormSheet from "./IncomeFormSheet";

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando renda" className="flex flex-col gap-3">
      <div className="h-[96px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] motion-reduce:animate-none" />
      {[0, 1].map((i) => <div key={i} className="h-[72px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] motion-reduce:animate-none" />)}
    </div>
  );
}

/** Salário e outras rendas: ver, adicionar, editar e excluir. As rendas fixas entram no Planejamento. */
export default function IncomeView() {
  const [form, setForm] = useState<{ key: number; id?: string } | null>(null);
  const toast = useToast();
  const { data, error, reload } = useLiveQuery(async () => {
    const s = getServices();
    const [incomes, accounts] = await Promise.all([s.income.list(), s.accounts.list()]);
    // Principal primeiro; o resto na ordem em que foi cadastrado.
    return { incomes: [...incomes].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)), accounts };
  }, []);

  const editing = form?.id ? data?.incomes.find((i) => i.id === form.id) : undefined;
  const openNew = () => setForm({ key: Date.now() });
  const fixedTotal = data?.incomes.filter((i) => i.kind === "fixa").reduce((s, i) => s + i.amountCents, 0) ?? 0;
  const accName = new Map(data?.accounts.map((a) => [a.id, a.name]) ?? []);

  let body;
  if (!data && error) body = <ErrorState onRetry={reload} />;
  else if (!data) body = <Skeleton />;
  else if (data.incomes.length === 0) {
    body = (
      <EmptyState
        icon={<><path d="M12 2v20" /><path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>}
        title="Nenhuma renda cadastrada."
        description="Informe seu salário para o Planejamento mostrar quanto sobra em cada mês."
        action={<AddAccountButton label="Adicionar salário" onClick={openNew} />}
      />
    );
  } else {
    body = (
      <>
        <section aria-label="Renda fixa por mês" className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-5 py-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-white/40">Renda fixa por mês</p>
          <p className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight text-white">{formatCents(fixedTotal)}</p>
          <p className="text-[13px] text-white/45">É o que entra como receita prevista no Planejamento.</p>
        </section>
        <ul className="mt-5 flex flex-col gap-2.5">
          {data.incomes.map((i) => (
            <li key={i.id}>
              <button type="button" onClick={() => setForm({ key: Date.now(), id: i.id })} className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3 text-left transition active:scale-[0.99] hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-center leading-none">
                  <span>
                    <span className="block text-[10px] font-medium uppercase text-white/45">dia</span>
                    <span className="block text-[16px] font-semibold tabular-nums text-white">{i.payDay}</span>
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-white">{i.name}</span>
                  <span className="block truncate text-[13px] text-white/45">
                    {[i.isPrimary ? "Principal" : null, i.kind === "fixa" ? "Fixa" : "Variável (média)", i.accountId ? accName.get(i.accountId) : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="shrink-0 text-[15px] font-semibold tabular-nums text-ok">{formatCents(i.amountCents)}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-center"><AddAccountButton label="Adicionar renda" onClick={openNew} /></div>
      </>
    );
  }

  return (
    <main className="min-h-dvh pb-28">
      <div className="mx-auto w-full max-w-[460px] px-4 pt-6">
        <header className="mb-5">
          <h1 className="text-[26px] font-semibold tracking-tight text-white">Renda</h1>
          <p className="mt-1 text-[13px] text-white/45">Salário e outras rendas que você recebe todo mês.</p>
        </header>
        {body}
      </div>
      {form && data && (form.id ? editing : true) && (
        <IncomeFormSheet key={form.key} income={editing} accounts={data.accounts} first={data.incomes.length === 0} onClose={() => setForm(null)} onDone={toast.show} />
      )}
      <Toast message={toast.message} />
    </main>
  );
}
