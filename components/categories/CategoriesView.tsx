"use client";

import { useMemo, useState } from "react";
import AddAccountButton from "@/components/finance/AddAccountButton";
import PeriodSelector from "@/components/finance/PeriodSelector";
import PeriodSheet from "@/components/transactions/PeriodSheet";
import EmptyState from "@/components/ui/EmptyState";
import ErrorState from "@/components/ui/ErrorState";
import { PrimaryButton, Segmented } from "@/components/ui/FormControls";
import Toast from "@/components/ui/Toast";
import { KIND_TABS } from "@/features/categories/constants";
import { useCategoriesData } from "@/features/categories/useCategoriesData";
import { buildCategoryRows, movementLabel } from "@/features/categories/viewModels";
import { useFirstDay } from "@/features/settings/useSettingsData";
import { PERIODS, rangeFor, type PeriodId } from "@/features/transactions/periods";
import { useToast } from "@/hooks/useToast";
import { todayISODate } from "@/lib/date";
import { formatCents } from "@/lib/money";
import { getServices } from "@/services";
import type { CategoryKind } from "@/types/domain";
import CategoryFormSheet from "./CategoryFormSheet";

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando categorias" className="flex flex-col gap-2.5">
      {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-[72px] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.03] motion-reduce:animate-none" />)}
    </div>
  );
}

/** Categorias reais: total por categoria no período, criar, editar e excluir (com mover registros). */
export default function CategoriesView() {
  const today = useMemo(() => todayISODate(), []);
  const [kind, setKind] = useState<CategoryKind>("despesa");
  const [periodId, setPeriodId] = useState<PeriodId>("mes");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [form, setForm] = useState<{ key: number; id?: string } | null>(null);
  const [seeding, setSeeding] = useState(false);
  const toast = useToast();

  const firstDay = useFirstDay();
  const range = useMemo(() => rangeFor(periodId, today, firstDay), [periodId, today, firstDay]);
  const { data, error, reload } = useCategoriesData(range);
  const period = PERIODS.find((p) => p.id === periodId)!;

  const { rows, totalCents } = useMemo(() => buildCategoryRows(data ?? [], kind), [data, kind]);
  const editing = form?.id ? data?.find((i) => i.category.id === form.id) : undefined;

  const seed = async () => {
    setSeeding(true);
    try { await getServices().categories.seedDefaults(); toast.show("Categorias padrão criadas."); }
    catch { toast.show("Não foi possível criar agora."); }
    setSeeding(false);
  };

  let body;
  if (!data && error) body = <ErrorState onRetry={reload} />;
  else if (!data) body = <Skeleton />;
  else if (data.length === 0) {
    body = (
      <EmptyState
        icon={<><path d="M4 7h16M4 12h16M4 17h10" /></>}
        title="Você ainda não possui categorias."
        description="Crie as categorias padrão para começar ou adicione as suas."
        action={<div className="w-60"><PrimaryButton disabled={seeding} onClick={seed}>Criar categorias padrão</PrimaryButton></div>}
      />
    );
  } else {
    body = (
      <>
        {error && <div className="mb-4"><ErrorState title="Não foi possível atualizar" onRetry={reload} /></div>}
        <div className="mb-4"><Segmented ariaLabel="Tipo de categoria" value={kind} onChange={setKind} options={KIND_TABS.map((t) => ({ value: t.value, label: t.label }))} /></div>

        <section aria-label="Total do período" className="mb-5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5">
          <p className="text-[12px] text-white/45">{kind === "despesa" ? "Despesas" : "Receitas"} · {period.label.toLowerCase()}</p>
          <p className="mt-0.5 truncate text-[26px] font-semibold tabular-nums tracking-tight text-white" title={formatCents(totalCents)}>{formatCents(totalCents)}</p>
        </section>

        {rows.length === 0 ? (
          <EmptyState
            icon={<><path d="M4 7h16M4 12h16M4 17h10" /></>}
            title={`Nenhuma categoria de ${kind === "despesa" ? "despesa" : "receita"}.`}
            description="Crie uma para organizar seus lançamentos."
            action={<AddAccountButton label="Nova categoria" onClick={() => setForm({ key: Date.now() })} />}
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {rows.map((r) => {
              const color = r.category.color ?? "#9AA0A8";
              return (
                <li key={r.category.id}>
                  <button
                    type="button"
                    onClick={() => setForm({ key: Date.now(), id: r.category.id })}
                    aria-label={`${r.category.name}, ${formatCents(r.periodCents)}`}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3 text-left transition active:scale-[0.99] hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[15px] font-bold" style={{ background: `${color}22`, color }} aria-hidden>{r.category.name.slice(0, 1).toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-medium text-white">{r.category.name}</span>
                        {r.category.isDefault && <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/45">Padrão</span>}
                      </span>
                      <span className="block truncate text-[12px] text-white/45">{movementLabel(r.periodCount)}{r.periodCents > 0 ? ` · ${r.sharePercent}%` : ""}</span>
                      <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
                        <span className="block h-full rounded-full" style={{ width: `${r.sharePercent}%`, background: color }} />
                      </span>
                    </span>
                    <span className="max-w-[40%] shrink-0 truncate text-[15px] font-semibold tabular-nums text-white" title={formatCents(r.periodCents)}>{formatCents(r.periodCents)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </>
    );
  }

  return (
    <main className="min-h-dvh pb-28">
      <div className="mx-auto w-full max-w-[460px] px-4 pt-6">
        <header className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-[26px] font-semibold tracking-tight text-white">Categorias</h1>
          <div className="flex items-center gap-2">
            {data && data.length > 0 && <PeriodSelector label={period.short} onClick={() => setPeriodOpen(true)} />}
          </div>
        </header>
        {body}
        {data && data.length > 0 && rows.length > 0 && (
          <div className="mt-5 flex justify-center"><AddAccountButton label="Nova categoria" onClick={() => setForm({ key: Date.now() })} /></div>
        )}
      </div>
      {periodOpen && <PeriodSheet value={periodId} onSelect={setPeriodId} onClose={() => setPeriodOpen(false)} />}
      {form && data && (form.id ? editing : true) && (
        <CategoryFormSheet key={form.key} item={editing} kind={editing?.category.kind ?? kind} all={data.map((i) => i.category)} onClose={() => setForm(null)} onDone={toast.show} />
      )}
      <Toast message={toast.message} />
    </main>
  );
}
