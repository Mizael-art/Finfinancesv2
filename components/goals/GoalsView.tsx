"use client";

import { useState } from "react";
import AddAccountButton from "@/components/finance/AddAccountButton";
import GoalCard from "@/components/finance/GoalCard";
import GoalsSummary from "@/components/finance/GoalsSummary";
import BottomNavigation from "@/components/ui/BottomNavigation";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import Toast from "@/components/ui/Toast";
import { useGoalsData } from "@/features/goals/useGoalsData";
import { toGoalCard } from "@/features/goals/viewModels";
import { useToast } from "@/hooks/useToast";
import GoalFormSheet from "./GoalFormSheet";
import GoalMoveSheet from "./GoalMoveSheet";

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando metas" className="flex flex-col gap-3">
      <div className="h-[130px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] motion-reduce:animate-none" />
      {[0, 1, 2].map((i) => <div key={i} className="h-[150px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] motion-reduce:animate-none" />)}
    </div>
  );
}

type Sheet = { key: number; kind: "form" | "deposit" | "withdraw"; id?: string };

/** Metas reais: criar, editar, excluir, adicionar e retirar valor. */
export default function GoalsView() {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const toast = useToast();
  const { data, error, reload } = useGoalsData();
  const open = (kind: Sheet["kind"], id?: string) => setSheet({ key: Date.now(), kind, id });
  const target = sheet?.id ? data?.items.find((i) => i.goal.id === sheet.id)?.goal : undefined;

  let body;
  if (!data && error) body = <ErrorState onRetry={reload} />;
  else if (!data) body = <Skeleton />;
  else if (data.items.length === 0) {
    body = (
      <EmptyState
        icon={<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /></>}
        title="Você ainda não possui metas."
        description="Defina um objetivo, como uma viagem ou reserva de emergência, e acompanhe o quanto já guardou."
        action={<AddAccountButton label="Nova meta" onClick={() => open("form")} />}
      />
    );
  } else {
    body = (
      <>
        {error && <div className="mb-4"><ErrorState title="Não foi possível atualizar" onRetry={reload} /></div>}
        <div className="mb-6"><GoalsSummary totalSaved={data.totalSavedCents / 100} count={data.activeCount} /></div>
        <p className="mb-2.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-white/35">Suas metas</p>
        <ul className="flex flex-col gap-2.5">
          {data.items.map((i) => (
            <li key={i.goal.id}>
              <GoalCard goal={toGoalCard(i)} onEdit={() => open("form", i.goal.id)} onAdd={() => open("deposit", i.goal.id)} onWithdraw={() => open("withdraw", i.goal.id)} />
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <main className="min-h-dvh pb-28">
      <div className="mx-auto w-full max-w-[460px] px-4 pt-6">
        <header className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-[26px] font-semibold tracking-tight text-white">Metas</h1>
          {data && data.items.length > 0 && <AddAccountButton label="Nova meta" onClick={() => open("form")} />}
        </header>
        {body}
      </div>
      <BottomNavigation />
      {sheet && data && (sheet.kind === "form" ? (!sheet.id || target) : target) && (
        sheet.kind === "form"
          ? <GoalFormSheet key={sheet.key} goal={target} onClose={() => setSheet(null)} onDone={toast.show} />
          : <GoalMoveSheet key={sheet.key} goal={target!} mode={sheet.kind} onClose={() => setSheet(null)} onDone={toast.show} />
      )}
      <Toast message={toast.message} />
    </main>
  );
}
